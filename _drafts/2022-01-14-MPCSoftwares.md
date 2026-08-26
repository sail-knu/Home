---
layout: single
title:  "MPC Softwares"
tags: [MPC]
comments: true
author_profile: false
toc: true
---


MPC 구현할 때 자주 사용하는 Software List:

**NMPC**

> ACADO [https://acado.github.io/](https://acado.github.io/)
>> MATLAB 인터페이스 제공
>> 
>> Embedded system에 사용하기 좋음 

> acados [https://docs.acados.org/](https://docs.acados.org/)
>> ACADO 후속 software - 더 빠르다고 하는데 ACADO도 충분히 빠름.

> CasADi [https://web.casadi.org/](https://web.casadi.org/)
>> Interior-point (IPOPT) 이용 - 스케일이 큰 최적화 문제에 적합
>> (System identification 같이 많은 데이터를 이용하는 경우)
>>
>> 개인적으로 ACADO 보다 customize가 쉬움


![title](/fig/noncvx_comptime_compare.png){: width="500"}{: .align-center}

Figure from.

Ref) Robin Verschueren et al., "acados—a modular open-source framework for fast embedded optimal control", Mathematical Programming Computation 2022

**LMPC**

> CVX [http://cvxr.com/cvx/](http://cvxr.com/cvx/)
>> MATLAB 을 위한 Convex optimization
>>
>> Gurobi, Mosek 등의 solver 지원

> CVXPY [https://www.cvxpy.org/](https://www.cvxpy.org/)
>> Python 을 위한 Convex optimization

> CVXGEN [https://cvxgen.com/](https://cvxgen.com/docs/index.html)
>> Convex optimization위한 코드 생성 

> qpOASES, quadprog ...

2-dim toy example에서 연산속도 비교.

qpSWIFT > CVXGEN > qpOASES >> quadprog

![title](/fig/cvx_comptime_compare.png){: width="500"}{: .align-center}


**Reachability, Tube MPC**


> CORA [https://tumcps.github.io/CORA/](https://tumcps.github.io/CORA/)
>> Zonotope 연산에 사용했었음

> MPT3 (Multi-Parametric Toolbox 3) [https://www.mpt3.org/](https://www.mpt3.org/)
>> 가장 많이 씀

