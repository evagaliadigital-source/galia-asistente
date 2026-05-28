module.exports = {
  apps: [
    {
      name: 'galia-asistente',
      script: 'src/server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // OpenAI / Genspark proxy
        GSK_API_KEY: 'gsk-eyJjb2dlbl9pZCI6ImE5NWMzMGMyLTJkMzktNDE0NC1iYWFmLTE5MzgwZWUxMjBjNSIsImtleV9pZCI6ImIzYmFiZjRlLWY4OTYtNDE4NC1iN2ZiLTk5MTE3Yjg5ZjY0YyIsImN0aW1lIjoxNzc5ODM1NzA2LCJjbGF1ZGVfYmlnX21vZGVsIjpudWxsLCJjbGF1ZGVfbWlkZGxlX21vZGVsIjpudWxsLCJjbGF1ZGVfc21hbGxfbW9kZWwiOm51bGx9fPTOiHn4M3Fnyyk85IZcWRXnlqziGyHQZ6PSK8YKTGb9',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        // Panel interno
        ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'galia_admin_2025',
        // ─── WhatsApp Cloud API (Meta) ───────────────────────────────
        WA_PHONE_NUMBER_ID: '1061621347044439',
        WA_BUSINESS_ACCOUNT_ID: '1376971050938405',
        WA_ACCESS_TOKEN: 'EAAN8O9HL53YBRk2suNFx09FES8J2tv29JtoW6UFxzHCvn1KbTZCyyVt4CXfRFBRzsRDTNdWSQX4DLiZB5gkajZAZBwWKAZCkZCBLxxYjZBZAoIRj6wkrW19ngayn0sCKJTabptEoYhZBxHKci5CfDiuIsgu6Hw5bqgnEZAVmTbzlS2CnRljyEnmksOrE07PQd2uO5ZBFr4nkTZAMu6siFTPKyAZByScCZCacvPXqfSuglPcl1MLnqsZCrjmUSg0LP6jZBIBBDRsdsi331omclueLf0ZCqHeQn2VZAr',
        WA_VERIFY_TOKEN: 'galia_webhook_2025',
        // ─── Email notificaciones (Resend) ───────────────────────────
        RESEND_API_KEY: process.env.RESEND_API_KEY || 're_TGJwmrzA_GqhoBzQkxfLEWz5LbnzQe2dn',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
    },
  ],
};
