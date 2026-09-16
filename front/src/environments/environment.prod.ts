export const environment = {
  production: true,
  // Servi derrière le même domaine que le frontend (proxy Nginx → Laravel).
  // Voir deploy/nginx.conf.example.
  apiUrl: '/api'
};
