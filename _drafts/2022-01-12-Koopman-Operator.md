---
layout: single
title:  "Koopman Operator"
tags: [Koopman]
last_modified_at: 2023-04-13T16:00+09:00
comments: true
author_profile: false
toc: true
---


## What is Koopman Operator ?

Koopman Operator는 비선형 시스템을 (by evolving functions of the state "as known as observable function") infinite-dim.의 선형 시스템으로 표현해주는 Operator.

(In application) infinite-dim.으로 표현하는 것은 어렵기 때문에 finite-dim.의 선형 시스템으로 근사화하여 표현함.

![title](/fig/koopman_concept.png){: width="600"}{: .align-center}
[Image from Ref [3]]

How to approximate
- Data-driven
- No prior information
- DMD, EDMD, DNN 등의 방법들이 사용됨

## Basic Mathematical Formulation

Discrete-time 시스템:

$$
x_{k+1} = f(x_k)
$$

where $x_k \in \mathbb{R}^x$.

Let observation function: $g(x) \in \mathbb{G} : \mathbb{R}^x \rightarrow \mathbb{R}^y$.

$$
y_k = g(x_k)
$$

where $y_k \in \mathbb{R}^y$.

Let Koopman operator $\mathcal K : \mathbb{G} \rightarrow \mathbb{G}$.

$$
  \mathcal{K}g (x) = g(f(x))
$$

$$
  \mathcal{K}g (x_k) = g(f(x_k)) = g(x_{k+1})
$$

&rarr; Koopman operator 를 이용하여 $y$ 를 propagate 하는 것과 propagate한 $x$를 $y$로 lift 한것이 같음.

## Approximating a Koopman Operator
Let user-defined vector-valued function $\Psi(x)$ as follwos:

$$
\Psi(x) = [\psi_1 (x), \psi_2 (x), \ldots, \psi_N (x)].
$$

이 함수들로 다음과 같이 $y_k = g(x_k)$를 다시 표현할 수 있음

$$
y_k = \Psi(x_k)
$$

그러면 Koopman operator는 다음의 관계를 가짐

$$
\Psi(x_{k+1}) = K\Psi(x_k) + w
$$

where $K\in \mathbb{C}^{N\times N}$ and w is an error.

{: .notice--info}
제어기 설계할 때 근사화 오차를 고려할 필요가 있음 (Robust Control).


$$
\text{Cost function} : J = \sum^{P-1}_{p=1} || \Psi(x_{p+1}) - K\Psi(x_{p}) ||^2
$$


$P$ : 데이터 개수

$J$를 최소화 하는 $K$ 찾아야함.

가장 기본적인 방법: *"Least-square"*

$$
K = G^\dagger A,\\
G = \frac{1}{P} \sum^{P-1}_{p=1} \Psi(x_p)^\top\Psi(x_p) ,\\
A = \frac{1}{P} \sum^{P-1}_{p=1} \Psi(x_p)^\top\Psi(x_{p+1}),
$$

$\Psi$의 차원이 커질수록 계산이 어려움. 하지만 차원이 커야 Koopman operator를 이용한 모델링 성능이 좋아짐. 

&rarr; 차원이 높은, 복잡한 시스템에 적용하기에는 어려움이 있음 (최근 Deep Koopman Operator를 이용한 연구가 활발해진 이유 - DNN를 사용하는 경우, user-defined vector-valued function을 네트워크로 찾을 수 있고 복잡한 최적화 문제를 해결가능).

{: .notice--info}
Koopman modeling 사용해서 제어기 설계하는 연구를 하는 경우에는 굳이 NN를 쓸 필요는 없어보임. 물론 실제 application에 적용할때는 유용할듯.

<!-- ``` 
search: false
$$
\begin{bmatrix}
x_2\\
y_2\\
z_2  
\end{bmatrix}
= R \begin{bmatrix}
                  x_1\\
                  y_1\\
                  z_1  
                  \end{bmatrix}
$$
```

**Note:** `search: false` only works to exclude posts when using **Lunr** as a search provider. \overline{bel}(x_t) = \int_{x_{t-1}}p(x_t \mid x_{t-1}, u_{t}) bel(x_{t-1}) dx_{t-1}

{: .notice--info}

To exclude files when using **Algolia** as a search provider add an array to `algolia.files_to_exclude` in your `_config.yml`. For more configuration options be sure to check their [full documentation](https://community.algolia.com/jekyll-algolia/options.html).
$$
\overline{bel}(x_t) = \int_{x_{t-1}}p(x_t \mid x_{t-1}, u_{t}) bel(x_{t-1}) dx_{t-1}
$$


```yaml
algolia:
  # Exclude more files from indexing
  files_to_exclude:
    - index.html
    - index.md
    - excluded-file.html
    - _posts/2017-11-28-post-exclude-search.md
    - subdirectory/*.html
``` -->


## Analytic Example (Optimal Control with Koopman Model)
해석가능한 example에 optimal control 적용.
- Lift state space
- Design optimal controller in lifted space
- Retract control input to get nonlinear controller


![title](/fig/Koopman_Control.png){: width="300"}{: .align-center}
![title](/fig/KLQR.png)
![title](/fig/KMPC.png)
![title](/fig/KMPC_Compare.png)

Linear MPC와 비슷한 연산량으로 NMPC와 비슷한 performance를 보여줌.


## References
[1] Ian Abraham et al., "[Model-Based Control Using Koopman Operators](https://arxiv.org/pdf/1709.01568.pdf)", RSS 2017 (citation 90&uarr;)

[2] Ian Abraham et al., "[Active Learning of Dynamics for Data-Driven Control Using Koopman Operators](https://ieeexplore.ieee.org/abstract/document/8759089)", IEEE Transactions on Robotics 2019 (citation 90&uarr;)

[3] Brunton, Steven L., et al. "[Koopman invariant subspaces and finite linear representations of nonlinear dynamical systems for control](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0150171)", PloS one 2016 (citation 380&uarr;)
