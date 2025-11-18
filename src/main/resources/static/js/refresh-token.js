setInterval(() => {
  fetch('/api/auth/refresh-token', {
    method: 'POST',
    credentials: 'include'
  });
}, 25 * 60 * 1000);
