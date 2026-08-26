---
layout: single
title:  "Linear MPC Implementation (CVXGEN)"
tags: [MPC]
last_modified_at: 2022-01-25T23:00+09:00
comments: true
author_profile: false
toc: true
---


#### How to implement Linear Model Predictive Control (LMPC) with CVXGEN?

1. https://cvxgen.com/ 에서 아이디 생성
2. *edit* 창에서 원하는 states, inputs, horizon, parameters 설정
    ![title](/fig/cvxgen1.png){: width="500"}{: .align-center}
3. *generate C* 창에서 code generation 실행
    ![title](/fig/cvxgen2.png){: width="500"}{: .align-center}
4. *matlab* 창에 화면에 나오는 커맨드 실행
    ![title](/fig/cvxgen3.png){: width="500"}{: .align-center}
5. matlab에서 다음의 파일들이 저장됨
    ![title](/fig/cvxgen4.png){: width="200"}{: .align-center}
6. csolve.mexw64 를 함수로 사용하면 됨. 이때 2.에서 설정한 파라미터들을 적절하게 설정해줘야함.
ex) 

```matlab
settings.verbose = 0; 
% 여러가지 세팅 조절가능. 이거는 solution에 대한 결과를 print할지를 결정하는 파라미터.

LMPC.A = A;
LMPC.B = B;
LMPC.Q = Q;
LMPC.P = P;
LMPC.R = R;
LMPC.x_0 = x0;
LMPC.u_max = u_max;
LMPC.u_min = u_min;

sol = csolve(LMPC,settings);
u_KMPC = sol.u{1}; % 첫번째 input 사용.

```




#### How to implement LMPC with qpOASES?

1. https://github.com/coin-or/qpOASES

```matlab

```