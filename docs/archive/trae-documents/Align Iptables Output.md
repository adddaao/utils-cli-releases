# Align Iptables Output Using Tabwriter

I will modify `internal/firewall/iptables.go` to format the `iptables` output into a properly aligned table using `text/tabwriter`.

## Implementation Details

1. **Modify** **`internal/firewall/iptables.go`**:

   * Import `text/tabwriter`.

   * In the `List` method:

     * Initialize a `*tabwriter.Writer` when the first matching line is found.

     * Define the table header with tab-separated columns: `包数`, `字节`, `动作`, `协议`, `选项`, `入接口`, `出接口`, `源地址`, `目标地址`, `信息`.

     * For each matching line:

       * Use `strings.Fields()` to split the raw output into fields.

       * Extract the first 9 fixed fields (Pkts, Bytes, Target, Prot, Opt, In, Out, Source, Destination).

       * Combine any remaining fields into the "Info" column.

       * Print the formatted row to the `tabwriter`.

     * Flush the `tabwriter` after processing all lines to ensure output is displayed.

