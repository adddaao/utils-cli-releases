I will modify the cleaning rules to remove default path fallback logic and directory protections, except for the Maven rule.

**1. Modify** **`internal/clean/macos.go`**

* In `DefaultPaths()`: Remove the fallback that defaults to the user home directory if no config paths are set. It will now strictly return the configured paths.

* In `Execute()`:

  * Remove the logic that injects default paths (Config or Home) when the input `paths` is empty.

  * Remove the "Critical Directory Protection" logic (the `forbidden` list containing `/System`, `/Library`, etc. and the associated checks).

**2. Modify** **`internal/clean/archive.go`**

* In `Execute()`: Remove the logic that falls back to `cfg.Clean.Archive.Paths` when the input `paths` is empty.

**3. Modify** **`internal/clean/temp.go`**

* In `Execute()`: Remove the logic that falls back to `cfg.Clean.Temp.Paths` when the input `paths` is empty.

**4. Modify** **`internal/clean/generic.go`**

* In `Execute()`: Remove the logic that falls back to `r.config.Paths` when the input `paths` is empty.

**5.** **`internal/clean/maven.go`**

* **No changes** will be made, as explicitly requested.

