---
title: 第一讲 极限与连续
---

# 第一讲 极限与连续

## 一、数列极限

### 1.1 定义

设 $\{a_n\}$ 是一个数列，$a \in \R$。若对任意 $\varepsilon > 0$，存在 $N \in \N$，使得当 $n > N$ 时，恒有 $\abs{a_n - a} < \varepsilon$，则称数列收敛于 $a$，记作 $\lim\limits_{n\to\infty} a_n = a$。

下划线和星号不能被误解析：$a_1 * b_2 * c_3$ 与 $x_i^* = y_j^*$。

金额要用反斜杠转义：这本书卖 \$5，那本卖 \$10。

> [!definition] 定义 1.1（柯西列）
> 若对任意 $\varepsilon>0$，存在 $N$，使得 $m,n>N$ 时 $\abs{a_m-a_n}<\varepsilon$，则称 $\{a_n\}$ 为柯西列。

> [!theorem] 定理 1.2（单调有界原理）
> 单调有界数列必有极限。

### 1.2 重要极限

$$
\lim_{n\to\infty}\left(1+\frac{1}{n}\right)^n = e
$$

单行写法：

$$\sum_{k=1}^{\infty}\frac{1}{k^2}=\frac{\pi^2}{6}$$

LaTeX 风格分隔符：\(\int_0^1 x^2 \dif x = \tfrac13\)，以及

\[
\begin{aligned}
f(x) &= \sum_{n=0}^{\infty} \frac{f^{(n)}(0)}{n!} x^n \\
     &= f(0) + f'(0)x + \frac{f''(0)}{2!}x^2 + \cdots
\end{aligned}
\]

<div style="page-break-after: always;"></div>

## 二、函数的连续性

分段函数：

$$
\operatorname{sgn}(x)=\begin{cases}
1, & x>0,\\
0, & x=0,\\
-1, & x<0.
\end{cases}
$$

矩阵与带编号公式：

$$
A=\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix},\qquad \det A = -2 \tag{2.1}
$$

1. 第一条：$f$ 在 $x_0$ 处连续当且仅当 $\lim_{x\to x_0} f(x)=f(x_0)$
2. 第二条：**闭区间**上的连续函数有界
3. 第三条：介值定理

- 无序列表项 A
- 无序列表项 B

| 性质 | 开区间 | 闭区间 |
| ---- | :----: | :----: |
| 有界性 | 不一定 | $\checkmark$ |
| 最值 | 不一定 | $\checkmark$ |

\newpage

## 三、习题

行内代码 `numpy.linspace`，以及代码块：

```python
import numpy as np
x = np.linspace(0, 1, 100)
print((x ** 2).mean())
```

故意写错的公式（应该被报告出来）：$\frac{1}{$ 后面继续。

**习题 1** 求 $\displaystyle\lim_{x\to 0}\frac{\sin x}{x}$。
