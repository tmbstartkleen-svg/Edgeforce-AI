import{t as e}from"./db-9LtqYd6N.js";async function t(){let t=e();if(!t)return{source:`demo`,alerts:[],decisions:[],positions:[],bankroll:[],modelHealth:[],lineMoves:[]};let[n,r,i,a,o,s]=await Promise.all([t`
   select id,alert_type as type,severity,market_id as "marketId",message,
    created_at as "createdAt"
   from alerts where resolved_at is null order by created_at desc limit 50
  `,t`
   select id,market_id as "marketId",action,reasons,after_state as "afterState",
    created_at as "createdAt"
   from decision_journal order by created_at desc limit 50
  `,t`
   select id,event_id as "eventId",market_key as "marketKey",selection_key as "selectionKey",
    sport,stake,odds,model_probability as "modelProbability",
    current_probability as "currentProbability",
    expected_value as "expectedValue",
    current_expected_value as "currentExpectedValue",
    lifecycle_state as "state",opened_at as "openedAt"
   from open_positions where status='open' order by opened_at desc limit 100
  `,t`
   select id,name,starting_bankroll as "startingBankroll",current_bankroll as "currentBankroll",
    updated_at as "updatedAt"
   from bankroll_accounts order by id asc limit 10
  `,t`
   select sport,market_key as "marketKey",sample_size as "sampleSize",
    brier_score as "brierScore",log_loss as "logLoss",
    calibration_error as "calibrationError",roi,avg_clv as "avgClv",
    max_drawdown as "maxDrawdown",updated_at as "updatedAt"
   from sport_model_performance order by updated_at desc limit 50
  `,t`
   select market_id as "marketId",trigger_type as "triggerType",
    previous_probability as "previousProbability",
    new_probability as "newProbability",
    previous_ev as "previousEv",new_ev as "newEv",
    created_at as "createdAt"
   from repricing_events order by created_at desc limit 100
  `]);return{source:`database`,alerts:n,decisions:r,positions:i,bankroll:a,modelHealth:o,lineMoves:s}}async function n(){return Response.json(await t())}export{n as GET};