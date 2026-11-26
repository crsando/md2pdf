# md2pdf

把 Markdown 数学讲义导出成 PDF，视觉风格复刻 [doocs/md](https://github.com/doocs/md) 默认主题。公式用 MathJax 在本地渲染，排版由本机 Chrome 完成，不联网、不需要复制粘贴。

## 用法

```bash
node md2pdf.mjs 讲义.md                 # 生成 讲义.pdf（与 md 同目录）
node md2pdf.mjs 第*.md -o out/          # 批量导出到 out/
node md2pdf.mjs 讲义.md -o 成品.pdf     # 指定输出文件
node md2pdf.mjs 讲义.md --html          # 额外保留中间 HTML，方便调样式
node md2pdf.mjs 讲义.md --strict        # 有公式报错就不出 PDF
node md2pdf.mjs 讲义.md --no-page-number
```

## 写法约定

- **公式**：`$...$` 行内，`$$...$$` 独立成行；也支持 `\(...\)` 和 `\[...\]`。判定规则与 doocs 完全一致。
- **金额里的 `$`**：要写成 `\$5`。只有紧跟在数字后面的 `$` 会被自动识别成金额，这一点和 doocs 相同。
- **换页**：单独一行写下面任意一种：
  - `<div style="page-break-after: always;"></div>`
  - `\newpage`
  - `<!-- pagebreak -->`
- **定理类提示块**：`> [!theorem] 定理 1.2（标题）`，另外支持 definition / lemma / proof / remark / note / tip / warning 等。
- **公式编号**：在公式里写 `\tag{2.1}`。如果想自动编号，把配置里的 `math.tags` 改成 `"ams"`。
- **公式报错**：终端会列出出错的行号和原文，PDF 里对应位置显示红色原文，不会悄悄漏掉。

## 配置

全局配置文件是 `md2pdf.config.json`，各字段如下：

| 字段 | 说明 |
| --- | --- |
| `contentWidth` | 版心最大宽度。默认 `750px`，和 doocs 一致；A4 加默认页边距后正文区约 718px，所以实际效果是铺满。 |
| `page.margin` | 页边距，顺序为上、右、下、左。 |
| `theme.*` | 主色、字体、字号、行高、段落间距、首行缩进、两端对齐。 |
| `pageNumber.*` | 页码格式（`{n}` 当前页，`{m}` 总页数）、颜色、字号、与正文的间距。 |
| `math.macros` | 全局宏文件，默认 `macros.tex`。 |
| `codeTheme` / `macCodeBlock` | 代码高亮主题、是否显示 Mac 风格的三个圆点。 |
| `customCssFile` | 额外的 CSS 文件（可选，默认 `custom.css`，文件不存在就忽略）。 |

配置可以按三层覆盖，后面的覆盖前面的：

1. 工具目录下的 `md2pdf.config.json`（全局默认）
2. 讲义同目录下的 `md2pdf.config.json`（按课程覆盖）
3. 单个文件 front matter 里的 `md2pdf:` 字段

单个文件覆盖的写法示例：

```yaml
---
title: 第一讲
md2pdf:
  pageNumber: { format: "第 {n} 页" }
---
```

## 结构

```
md2pdf.mjs            命令行入口
lib/render.mjs        marked 渲染器（照搬 doocs 的渲染规则，breaks: true）
lib/math.mjs          MathJax TeX -> SVG（Node 本地运行）
lib/template.mjs      主题 CSS + 导出布局 + @page 页码
lib/pdf.mjs           Playwright 驱动本机 Chrome，调用 page.pdf()
themes/               doocs 主题 CSS（原样拷贝）
vendor/               doocs 的公式判定规则和提示块扩展（WTFPL 许可）
```
