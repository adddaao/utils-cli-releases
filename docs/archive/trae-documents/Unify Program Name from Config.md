# Unified Program Name Configuration Plan

This plan will centralize the application name configuration in `rutil.toml`, allowing the CLI to dynamically update its usage, help messages, and installation paths based on the configured name.

## 1. Update Configuration Logic (`internal/config`)

- **`internal/config/config.go`**:
    - Add `AppName` field to `AppConfig` struct.
    - Set default value for `app_name` to `"RUtil"`.
    - Update `defaultToml` template to include `app_name`.

## 2. Update Main Entry Point (`cmd/dit`)

- **`cmd/dit/main.go`**:
    - In `NewRootCmd`, modify `PersistentPreRunE` to:
        - Retrieve the configured `AppName`.
        - Update `cmd.Root().Use` to the configured name.
        - Replace instances of "RUtil" in `Short` and `Long` descriptions with the configured name.

## 3. Update Installation Logic (`internal/install`)

- **`internal/install/install_unix.go`**:
    - Use `config.Get().AppName` instead of hardcoded `"RUtil"` for the target binary name and messages.
- **`internal/install/install_windows.go`**:
    - Use `config.Get().AppName` for the installation directory (`.../Programs/<AppName>`) and binary name (`<AppName>.exe`).
    - Update status messages to reflect the new name.
