## 变更目标
- Docker 模块的 `path` 默认指向当前可执行文件所在目录，而非工作目录或 `./images/`。

## 技术实现
- 增加 `execDir()` 方法：使用 `os.Executable()` + `filepath.EvalSymlinks` 获取真实可执行文件目录。
- 加载默认值：将 `viper.SetDefault("docker.path", ".")`，不再硬编码 `./images/`。
- 规范化逻辑：在 `validateAndNormalize` 中为 Docker 路径使用 `baseDocker := execDir()`；
  - `current.Docker.Path = normalizePath(current.Docker.Path, baseDocker)`
  - 若为空则回退到 `baseDocker`（不追加 `images/`）。
- 兼容性：保留其他路径（如日志）继续使用现有 `debug/cwd` 与 `home` 基准，不受影响。
- 绑定输出：保持 `current.OutputDir = current.Docker.Path`，交互时默认即为可执行目录。

## 文件改动
- `internal/config/config.go`
  - 新增 `execDir()` 方法。
  - 修改 `Load()` 中 Docker 默认值为 `"."`。
  - 修改 `validateAndNormalize()`：Docker 路径改用 `execDir()` 作为基准并更新回退逻辑。
  - （可选）`defaultToml()` 将 `[docker] path` 示例从 `"./images/"` 改为 `"."` 并更新注释说明。

## 验证
- 在本机与打包后的二进制运行：不传配置时，`wizard/save` 与 `docker` 流程默认路径为可执行文件所在目录。
- 开启 `--debug` 与关闭 `--debug` 均验证行为一致。
- 保证已有自定义 `path` 值仍被正常解析（绝对/相对均可）。

## 兼容与风险
- 不影响已有 Maven、日志、压缩等模块。
- 若用户依赖 `./images/` 默认行为，将改为可执行目录；此为一次性行为变更，文档将同步更新。