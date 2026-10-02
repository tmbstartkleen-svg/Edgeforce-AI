export const dynamic='force-dynamic';

export async function GET(){
  return Response.json({
    app:'Edgeforce AI',
    release:'30.0.0',
    modelVersion:process.env.MODEL_VERSION||null,
    expectedMigration:30,
    environment:process.env.VERCEL_ENV||process.env.NODE_ENV||'local',
    gitSha:process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||null,
    deploymentPolicy:'manual-prebuilt-only',
    probabilityRules:{
      minimumLegSimulation:.65,
      minimumJointProbability:.52,
      simulationRuns:10000,
      dailyTopLimit:30,
      weeklyTopLimit:30
    },
    releaseGates:[
      'build',
      'migration-check',
      'static-release-gate',
      'final-qa',
      'smoke',
      'load-check',
      'hosted-release-readiness'
    ],
    features:{
      trueJointMonteCarlo:true,
      automatedSettlement:true,
      playerPropSettlement:true,
      calibrationLearning:true,
      pregameResimulation:true,
      confidenceChangeEngine:true,
      replacementComparison:true,
      failClosedFeedIntegrity:true,
      releaseReadiness:true,
      explicitRollback:true
    },
    generatedAt:new Date().toISOString()
  },{headers:{'Cache-Control':'no-store'}});
}
