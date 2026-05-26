module.exports = {
  apps: [
    {
      name: 'galia-asistente',
      script: 'src/server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'galia_admin_2025',
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
