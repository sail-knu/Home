---
layout: single
title:  "Nonlinear MPC Implementation (CasADi)"
tags: [MPC]
last_modified_at: 2023-01-25T23:00+09:00
comments: true
author_profile: false
toc: true
---
#### How to implement Nonlinear Model Predictive Control (NMPC) with CasADi?

http://casadi.org/ 에서 software 다운, directory 설정

```matlab
addpath('\casadi-windows-matlabR2016a-v3.5.5'); 
import casadi.*
% 경로 설정 및 import

% Prediction horizon
Num = 50; 

% Weighting scalars
q1 = 1;
q2 = 1;
r = 1;
p1 = 1;
p2 = 1;

%% Parameter setting - States
x = SX.sym('x'); 
y = SX.sym('y');
states = [x;y]; 
n_states = length(states);

%% Parameter setting - Inputs
u = SX.sym('u'); 
controls = u; 
n_controls = length(controls);

%% Parameter setting - Parameters
n_params = 1;

%% Casadi setting   
U = SX.sym('U',n_controls,Num); 
P = SX.sym('P',n_states+Num);
X = SX.sym('X',n_states,(Num+1));

objective = 0;  % Objective function
g = [];         % constraints vector

st  = X(:,1);   % initial state
g = [g;st-P(1:n_states)]; % initial condition constraints

%% calculate objective function
n_tot = n_states+n_controls+n_params;
for k = 1:Num
    st = X(:,k);  
    con = U(:,k); 
    param = P(n_states+k);

    %% Cost function    
    objective = objective + st(1)^2*q1 + st(2)^2*q2 + con(1)^2*r;

    st_next = X(:,k+1);
    flag = 1;
    if flag == 1
        % Euler
        xdot = vanderpol(st, con, param);
        st_next_euler = st + (dt*xdot);
        g = [g;st_next-st_next_euler]; % compute constraints
    else
        % RK45
        k1 = vanderpol(st , con, param);
        k2 = vanderpol(st+dt/2*k1, con, param);
        k3 = vanderpol(st+dt/2*k2, con, param);
        k4 = vanderpol(st+dt*k3  , con, param);
        st_next_RK45 = st + dt/6*(k1+2*k2+2*k3+k4);
        g = [g;st_next-st_next_RK45]; % compute constraints                
    end
end
st = X(:,Num+1);  
objective = objective + st(1)^2*p1 + st(2)^2*p2;

OPT_variables = [reshape(X,n_states*(Num+1),1);reshape(U,n_controls*Num,1)];

nlp_prob = struct('f', objective, 'x', OPT_variables, 'g', g, 'p', P);

opts = struct;
opts.ipopt.max_iter = 20;
opts.ipopt.print_level = 0; % 0 ~ 3
opts.print_time = 0;
opts.ipopt.acceptable_tol = 1e-8;
opts.ipopt.acceptable_obj_change_tol = 1e-8;

NMPC.solver = nlpsol('solver', 'ipopt', nlp_prob,opts);


%% Equaility contraints : Dyanmic equations 
NMPC.args.lbg(1:n_states*(Num+1)) = -1e-10;  % -1e-20   % Equality constraints
NMPC.args.ubg(1:n_states*(Num+1)) =  1e-10;  %  1e-20   % Equality constraints

%% Inequaility contraints : States & Inputs
NMPC.args.lbx(1:n_states:n_states*(Num+1),1) =  -10;     % state x1 lower bound 
NMPC.args.ubx(1:n_states:n_states*(Num+1),1) =  10;      % state x1 upper bound 
NMPC.args.lbx(2:n_states:n_states*(Num+1),1) =  -10;     % state x2 lower bound
NMPC.args.ubx(2:n_states:n_states*(Num+1),1) =  10;      % state x2 upper bound
NMPC.args.lbx(n_states*(Num+1)+1:n_controls:n_states*(Num+1)+n_controls*Num,1) = u_min; % u lower bound
NMPC.args.ubx(n_states*(Num+1)+1:n_controls:n_states*(Num+1)+n_controls*Num,1) = u_max; % u upper bound

disp('*************** MPC setting ***************')
disp(strcat('Prediction Num :` ' , num2str(Num)))
disp(strcat('Prediction Ts :` ' , num2str(dt) ,'sec'))
if flag == 1
    disp('Integration algorithm : Euler method')
else
    disp('Integration algorithm : RK 45')
end

NMPC.args.p(1:n) = [init_x];
NMPC.args.p(n+1) = 0.8;



NMPC.input.u0 = u_min*ones(Num,n_controls);
NMPC.input.X0 = repmat(init_x,1,Num+1)'; 

tic;
NMPC.args.x0  = [reshape(NMPC.input.X0',n_states*(Num+1),1);reshape(NMPC.input.u0',n_controls*Num,1)];
sol = NMPC.solver('x0', NMPC.args.x0, 'lbx', NMPC.args.lbx, 'ubx', NMPC.args.ubx,...
    'lbg', NMPC.args.lbg, 'ubg', NMPC.args.ubg,'p',NMPC.args.p);
usol = reshape(full(sol.x(n_states*(Num+1)+1:end))',n_controls,Num)'; % get controls only from the solution
xsol= reshape(full(sol.x(1:n_states*(Num+1)))',n_states,Num+1)'; % get solution TRAJECTORY

NMPC.input.X0 = [xsol(2:end,:);xsol(end,:)];
NMPC.input.u0 = [usol(2:end,:);usol(end,:)];

caltime = toc;
Q_command = usol(1);
```

