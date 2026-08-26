---
layout: single
title:  "Robust State-Feedback Control (Linear Matrix Inequality (LMI))"
tags: [MPC, Robust MPC]
last_modified_at: 2023-02-05T16:00+09:00
comments: true
author_profile: false
toc: true
---

$$
x_{t+1} = A(p_t)x_t + Bu_t 
$$

LPV-A 시스템을 stabilize할 수 있는 state feedback control gain K 찾기

$$
u_t = Kx_t
$$

"Quadratic stabilization"

$$
J = \sum_0^{\infty} x_t^\top Q x_t + u_t^\top R u_t
$$

worst case cost를 minimze할 수 있는 LMI problem:

$$
    \min_{P,K} \text{tr}(P)
$$

$$
    \text{s.t.} \quad A^c(p)^\top P A^c(P) - P \leq -Q - K^\top R K
$$

where $A^c(p) = A(p) + BK$

LMI의 standard trick ($S=P^{-1}, Y=KS$)이용하여 convexification.


$$
\begin{bmatrix}
P-Q-K^\top R K & {A^c}^\top \\
A^c & P^{-1}
\end{bmatrix} \geq 0
$$

$K = YS^{-1}, P = S^{-1}$ gives

$$
\begin{bmatrix}
S^{-1}-Q- S^{-1} Y^\top R YS^{-1} & A^\top+S^{-1}Y^\top B^\top \\
A+BYS^{-1} & S
\end{bmatrix} \geq 0
$$

$$
\Leftrightarrow\begin{bmatrix}
S-SQS- Y^\top R Y & SA^\top+ Y^\top B^\top\\
AS+BY & S
\end{bmatrix} \geq 0
$$

$$
\Leftrightarrow
\begin{bmatrix}
S & SA^\top+ Y^\top B^\top\\
AS+BY & S
\end{bmatrix} + 
\begin{bmatrix}
-SQS- Y^\top R Y & \mathbf{0} \\
\mathbf{0} & \mathbf{0}
\end{bmatrix} 
\geq 0
$$

$$
\Leftrightarrow
\begin{bmatrix}
S & SA^\top+ Y^\top B^\top\\
AS+BY & S
\end{bmatrix} + 
\begin{bmatrix}
-(Q^{1/2}S)^\top (Q^{1/2}S)- (R^{1/2}Y)^\top(R^{1/2} Y) & \mathbf{0} \\
\mathbf{0} & \mathbf{0}
\end{bmatrix} 
\geq 0
$$

$$
\Leftrightarrow
\begin{bmatrix}
S & SA^\top+ Y^\top B^\top\\
AS+BY & S
\end{bmatrix} - 
\begin{bmatrix}
SQ^{1/2}  & Y^\top R^{1/2} \\
\mathbf{0} & \mathbf{0}
\end{bmatrix} 
\begin{bmatrix}
\mathbf{I}  & \mathbf{0} \\
\mathbf{0} & \mathbf{I}
\end{bmatrix} 
\begin{bmatrix}
Q^{1/2}S  & \mathbf{0}  \\
R^{1/2} Y& \mathbf{0}
\end{bmatrix} 
\geq 0
$$

Finally, we obtain the following LMI condition.


$$
\begin{bmatrix}
S & SA^\top+ Y^\top B^\top & SQ^{1/2} & Y^\top R^{1/2} \\
AS+BY & S & \mathbf{0}  & \mathbf{0}  \\
Q^{1/2}S & \mathbf{0}  & \mathbf{I} & \mathbf{0}  \\
R^{1/2} Y & \mathbf{0} &\mathbf{0} &\mathbf{I} 
\end{bmatrix} 
\geq 0
$$

## Reference
















[1] [https://yalmip.github.io/example/lpvstatefeedback/](https://yalmip.github.io/example/lpvstatefeedback/)