#! /usr/bin/env node

import { spawn } from 'child_process'
import EventEmitter from 'events'

type WritableStream = NodeJS.WritableStream
type Logger = {
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string, { trace }? : { trace?: string }) => void
}
type WiexOptions = {
  version?: boolean
  strict?: boolean
  verbose?: boolean
  help?: boolean
}

const WIEX_OPTIONS: Set<`--${keyof WiexOptions}`> = new Set(['--version', '--strict', '--verbose', '--help'])

const { version } = require('./package.json')

const helpText = `\
wiex: Windows Invoke Expression for WSL2

wiex invoke given windows .exe command by expanding $PATH with $WIEX_PATH

Usage:
\twiex [wiex options] [.exe command] [.exe options]

Options:
\t--version\tPrint version info and exit
\t--strict\tRaise error severity level
\t--verbose\tPrint info log
\t--help\t\tPrint help information
`

export async function wiex (
  { command, commandArgs }: { command: string, commandArgs?: Array<string>},
  { outStream, errStream, logger: _logger }: { outStream: WritableStream, errStream: WritableStream, logger: Logger },
  { strict, verbose } : WiexOptions = {}
): Promise<void> {
  const logger = { ..._logger, errorIfStrictOrWarn: strict ? _logger.error : _logger.warn }
  const rejectIfStrictOrResolve = strict ? (err?: string) => Promise.reject(err) : (code?: number) => Promise.resolve(code)

  const { WIEX_PATH, PATH } = process.env
  if (!WIEX_PATH) {
    logger.warn('$WIEX_PATH is not set, so wiex not expand $PATH')
  }

  const commandNotExistErrorMessage = `Error: ${command} not found`
  try {
    const where = spawn(`where ${command}`)
    where.on('close', (code) => {
      if (code === null || code > 0) {
        logger.error(commandNotExistErrorMessage)
        process.exit(1)
      }
    })
    where.on('error', () => {
      logger.error(commandNotExistErrorMessage)
      process.exit(1)
    })
  } catch {
    logger.error(commandNotExistErrorMessage)
    process.exit(1)
  }

  const proc = spawn(command, commandArgs, { env: { ...process.env, PATH: `${PATH}:${WIEX_PATH}` } })

  const { pid } = proc

  proc.stdout.pipe(outStream)
  proc.stderr.pipe(errStream)
  proc.on('exit', (code) => {
    if (code !== null) {
      process.exitCode = code
      Promise.resolve()
    } else {
      logger.errorIfStrictOrWarn('exit code is unknown')
      rejectIfStrictOrResolve()
    }
  })
  proc.on('disconnect', () => {
    logger.errorIfStrictOrWarn(`process ${pid} disconnected.`)
    rejectIfStrictOrResolve()
  })
  proc.on('close', () => {
    if (verbose) {
      logger.info(`process ${pid} closed.`)
    }
  })
}

function cli () {
  const args = process.argv.slice(2)

  const { wiexArgs, command, commandArgs } = [...args].reduce<{wiexArgs?: WiexOptions, command?: string, commandArgs?: Array<string>}>(({wiexArgs }, arg, index, arr) => {
    if ((WIEX_OPTIONS as Set<string>).has(arg)) {
      return { wiexArgs: { ...wiexArgs, [arg]: true } }
    } else {
      arr.splice(1) // early-break https://stackoverflow.com/questions/36144406/how-to-early-break-reduce-method
      return { wiexArgs, command: arg, commandArgs: args.slice(index + 1) }
    }
  }, {})

  if (wiexArgs?.version) {
    console.log(`v${version}`)
    process.exit(0)
  }

  if (wiexArgs?.help || (command === undefined)) {
    console.log(helpText)
    process.exit()
  }

  const logEmitter = new EventEmitter()

  logEmitter.on('info', ({ message }) => { console.log(message) })
  logEmitter.on('warn', ({ message }) => { console.warn(message) })
  logEmitter.on('error', ({ message, trace }: { message: string, trace?: string}) => {
    console.error(message)
    if (trace) {
      console.error(trace)
    }
  })

  const logger: Logger = {
    info: (message) => logEmitter.emit('info', { message }),
    warn: (message) => logEmitter.emit('warn', { message }),
    error: (message, { trace } = {}) => logEmitter.emit('error', { message, trace })
  }

  wiex({ command, commandArgs }, { outStream: process.stdout as WritableStream, errStream: process.stderr as WritableStream, logger }, wiexArgs)
    .catch((err) => {
      logger.error(err)
      process.exit(1)
    })
}

cli()
