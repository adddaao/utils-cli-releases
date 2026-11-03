I will migrate the Docker and Firewall modules to the Bubble Tea TUI framework, following the pattern of the Clean module.

**1. Refactor Logic for TUI Compatibility**
*   **`internal/ui/table.go`**: Add `RenderTable` to return a string instead of printing directly, enabling TUI display.
*   **`internal/firewall`**:
    *   Update `Manager` interface to include `ListOutput() (string, error)`.
    *   Implement `ListOutput` for `iptables`, `firewalld`, `ufw`, and `pfmacos`, ensuring they return the status string instead of printing it.
    *   Update `List` to use `ListOutput`.
*   **`internal/docker`**:
    *   Refactor `PruneExited` to return a summary string of actions taken.
    *   Ensure `CreateSystemdService` logs via `logger` and returns errors/success clearly.

**2. Implement TUI Models**
*   **`internal/tui/docker.go`**: Create `DockerModel` with:
    *   Menu: `1. Systemd Service`, `2. Prune Containers`.
    *   States: Input (for service name), Confirmation (for prune), Execution, and Result display.
*   **`internal/tui/firewall.go`**: Create `FirewallModel` with:
    *   Menu: `1. List Open Ports`, `2. Open Ports`, `3. Close Ports`.
    *   States: Input (for ports), Execution, and Result (displaying list output or success message).

**3. Integrate into Main Application**
*   **`internal/tui/app.go`**: Initialize `DockerModel` and `FirewallModel` and handle switching to them.
*   **`internal/tui/main_menu.go`**: Update the Update loop to transition to the new Docker and Firewall states.

This plan ensures all modules share the consistent TUI experience (numbered selection, structured output) requested.