---
layout: single
title:  "Linear Parameter Varying System"
tags: [Modeling]
comments: true
author_profile: false
toc: true
---



## Linear Parameter Varying System

: State-space representations depend on exogenous nonstationary parameters.

$$
\begin{aligned}
\dot{x} &= A(p)x + B(p)u \\
y &= C(p)x
\end{aligned}
$$


> 아래의 경우 LPV-A 모델이라고도 부름. (A만 p에의해 바뀌는 모델) 
> > $$
\dot{x} = A(p)x + Bu 
$$


> LTV (Linear Time-Varying) 모델과의 차이점은?
>> (By ChatGPT)
![title](/fig/chatGPT.jpg){: width="500"}{: .align-center}



## DMDc &rarr; LPV system identification

System:

>$$ \mathbf{x} \in \mathbb{R}^n, $$ 
>$$ \mathbf{u} \in \mathbb{R}^l $$ 
>
>$$ \mathbf{A} \in \mathbb{R}^{n\times n}, $$
>$$ \mathbf{B} \in \mathbb{R}^{n\times l} $$
>
>$$ \mathbf{p} \in \mathbb{R}, $$ 

Data (m 개의 데이터):

$$
\mathbf{X} = 
\begin{bmatrix}
| & | &  & | \\
\mathbf{x}_1 & \mathbf{x}_2 & \ldots & \mathbf{x}_{m-1} \\
| & | &  & | \\
\end{bmatrix}
$$

$$
\mathbf{X}^+ = 
\begin{bmatrix}
| & | &  & | \\
\mathbf{x}_2 & \mathbf{x}_3 & \ldots & \mathbf{x}_{m} \\
| & | &  & | \\
\end{bmatrix}
$$

$$
\mathbf{U}_c = 
\begin{bmatrix}
| & | &  & | \\
\mathbf{u}_1 & \mathbf{u}_2 & \ldots & \mathbf{u}_{m-1} \\
| & | &  & | \\
\end{bmatrix}
$$

$$
\mathbf{X}_p = 
\begin{bmatrix}
| & | &  & | \\
\mathbf{X}_1 \mathbf{p}_1 & \mathbf{X}_2 \mathbf{p}_2 & \ldots & \mathbf{X}_{m-1} \mathbf{p}_{m-1} \\
| & | &  & | \\
\end{bmatrix}
$$

>
> $$ \mathbf{X}^+\approx \mathbf{A}\mathbf{X} + \mathbf{A}_p\mathbf{X}_p + \mathbf{B}\mathbf{U_c} $$
>


### Assumption : known $\mathbf{B}$

>
> $$ \underbrace{\mathbf{X}^+ - \mathbf{B}\mathbf{U_c}}_{\text{"known"}} \approx \mathbf{A}\mathbf{X} + \mathbf{A}_p\mathbf{X}_p  $$

$$ 
\mathbf{X}^+  - \mathbf{B}\mathbf{U_c}
\approx 
\mathbf{G} \mathbf{\Omega} = \begin{bmatrix}
\mathbf{A} & \mathbf{A}_p \end{bmatrix}
\begin{bmatrix}
\mathbf{X} \\ \mathbf{X}_p
\end{bmatrix}
$$


$$ 
\begin{bmatrix}
\mathbf{A} & \mathbf{A}_p
\end{bmatrix} = 
(\mathbf{X}^+  - \mathbf{B}\mathbf{U_c}) \begin{bmatrix}
\mathbf{X} \\ \mathbf{X}_p
\end{bmatrix}^\dagger
$$



Least square problem : 

$$
||(\mathbf{X}^+  - \mathbf{B}\mathbf{U_c})- \mathbf{G}\mathbf{\Omega}||_F
$$

&rarr; SVD 로 pseudoinverse 찾기

$$
\mathbf{\Omega} = \mathbf{U}\mathbf{\Sigma}\mathbf{V}^* \approx \tilde{\mathbf{U}} \tilde{\mathbf{\Sigma}}\tilde{\mathbf{V}}^* 
$$

그러면 SVD를 통하여 다음과 같이 $\mathbf{G}$를 근사화 할 수 있음

$$
\mathbf{G}\approx \mathbf{\bar{G}} = \mathbf{X}^+
\tilde{\mathbf{V}} \tilde{\mathbf{\Sigma}}^{-1} \tilde{\mathbf{U}}^*
$$

> $$\mathbf{G} \in \mathbb{R}^{n\times (n+l)} $$

$$
\begin{bmatrix}
\mathbf{A} & \mathbf{A}_p
\end{bmatrix}
\approx
\begin{bmatrix}
\mathbf{X}^+
\tilde{\mathbf{V}} \tilde{\mathbf{\Sigma}}^{-1} \tilde{\mathbf{U}}^*_1
& 
\mathbf{X}^+
\tilde{\mathbf{V}} \tilde{\mathbf{\Sigma}}^{-1} \tilde{\mathbf{U}}^*_2
\end{bmatrix}
$$

> $$\tilde{\mathbf{U}}_1 \in \mathbb{R}^{n\times p} $$
> 
> $$\tilde{\mathbf{U}}_2 \in \mathbb{R}^{l\times p} $$

