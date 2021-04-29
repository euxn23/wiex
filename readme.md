# wiex: Windows Invoke Expression for WSL2

wiex invoke given windows .exe command by expanding $PATH with $WIEX_PATH

## Motivation
 
- If WSL2 `appendWindowsPath` interop option was enabled, PATH exploring failed with lack of access privileges for Windows system folders. This is reason for usability.
- If Windows binary PATH is added to Linux $PATH, and same name command is in $PATH, it depends on $PATH order which command is called. This is reason for safety.

## Example

```
$ export WIEX_PATH=/mnt/c/Users/alice/.cargo/bin
$ wiex cargo.exe --version
cargo 1.51.0 (43b129a20 2021-03-16)
```

## Installation

`$ npm install -g wiex`

## Usage

wiex [wiex options] [.exe command] [.exe options]

To see options, run `$ wiex help`

## Roadmap

- [ ] distribute binary built by rust implementation
- [ ] easy installation script

## License

MIT
