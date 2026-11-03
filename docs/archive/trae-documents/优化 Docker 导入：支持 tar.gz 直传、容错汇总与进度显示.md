# Docker 导入功能优化计划

## 1. 核心需求分析

* **优化 tar.gz 处理**：`tar.gz` 文件默认不解压，直接传递给 `docker load`（Docker 原生支持 gzip 压缩流）。如过失败记录失败并在最后汇总。

* **容错处理**：若遇到必须解压（如 7z）但工具缺失的情况，不中断整体流程，而是记录失败并在最后汇总。

* **进度提示**：

  * 显示总体进度 `(当前/总共)`。

  * 显示 Docker 原生导入进度（透传 stdout/stderr 或模拟进度条）。

## 2. 代码变更详情

### 2.1 修改 `internal/transfer/load.go`

* **`LoadImages`** **函数**：

  * 维护成功/失败计数与失败详情列表。

  * 遍历文件列表，对每个文件执行加载。

  * 在循环中打印进度 `fmt.Printf("[%d/%d] 正在导入 %s ...\n", i+1, total, file)`。

  * 捕获单个文件的错误，不中断循环，存入 `failures` 列表。

  * 最终打印汇总报告。

* **`loadOne`** **函数** (需调整或新增)：

  * 判断文件扩展名：

    * `.tar`, `.tar.gz`, `.tgz` -> 直接调用 `docker load -i <path>`。

    * `.7z` -> 尝试调用 7z 解压。若 `7z` 命令不存在，返回特定错误（"解压工具未找到"），由上层捕获。

  * **进度透传**：`docker load` 的输出通常较简单（"Loaded image: ..."），直接绑定 `cmd.Stdout = os.Stdout` 和 `cmd.Stderr = os.Stderr` 即可展示原生进度。

### 2.2 修改 `internal/compress` (可选)

* 检查 `7z` 是否存在的逻辑可能已存在，需确保其返回错误而非 panic。

### 2.3 交互逻辑调整 (`cmd/dit/main.go`)

* 确保 `NewLoadCmd` 和 `runWizardLoad` 调用新的 `LoadImages` 逻辑。

* 移除旧的“先解压后加载”逻辑（针对 tar.gz），仅针对 7z 保留解压提示或自动尝试。

## 3. 执行步骤

1. **重构** **`LoadImages`**：实现进度显示、错误收集与汇总报告。
2. **优化** **`loadOne`**：

   * 直接支持 `tar.gz`。

   * 对不支持的格式或缺失工具的情况进行软失败处理。

   * 绑定 Stdout/Stderr 以展示 Docker 原生输出。
3. **更新 CLI**：调整 `runWizardLoad`，不再强制全量解压 `tar.gz`。
4. **验证**：模拟缺失 7z 环境与正常环境，验证进度显示与汇总。

## 4. 预期输出示例

```text
[1/3] 正在导入 image1.tar.gz ...
Loaded image: image1:latest
[2/3] 正在导入 archive.7z ...
[警告] 无法解压 archive.7z: exec: "7z": executable file not found in $PATH
[3/3] 正在导入 image2.tar ...
Loaded image: image2:v1

================ 导入汇总 ================
成功: 2
失败: 1
失败列表:
  - archive.7z: 无法解压 (工具缺失)
```

