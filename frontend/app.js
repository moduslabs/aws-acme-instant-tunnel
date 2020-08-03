/* global window document localStorage fetch alert */

// Fill in with your values
const AUTH0_CLIENT_ID = 'srZfVKQ01KiWqdR82gIX8kdNf5dc0goU';
const AUTH0_DOMAIN = 'acme-instant-tunnel.us.auth0.com';
const AUTH0_CALLBACK_URL = window.location.href; // eslint-disable-line
//const PUBLIC_ENDPOINT = 'https://your-aws-endpoint-here.amazonaws.com/dev/api/public';
const PRIVATE_ENDPOINT =
  'https://3sjh80uyof.execute-api.us-east-1.amazonaws.com/dev/api/addLease';
const currentTime = Date.now();
// initialize auth0 lock
const lock = new Auth0Lock(AUTH0_CLIENT_ID, AUTH0_DOMAIN, {
  // eslint-disable-line no-undef

  auth: {
    params: {
      scope: 'openid email',
    },
    responseType: 'token id_token',
  },
});

function updateUI() {
  const isLoggedIn = localStorage.getItem('id_token');
  if (isLoggedIn) {
    // swap buttons
    document.getElementById('btn-login').style.display = 'none';
    document.getElementById('btn-logout').style.display = 'inline';
    const profile = JSON.parse(localStorage.getItem('profile'));
    console.log(profile);
    // show username
    document.getElementById('nick').textContent = profile.email;
  }
}

// Handle login
lock.on('authenticated', (authResult) => {
  console.log(authResult);
  lock.getUserInfo(authResult.accessToken, (error, profile) => {
    if (error) {
      // Handle error
      return;
    }

    document.getElementById('nick').textContent = profile.nickname;

    localStorage.setItem('accessToken', authResult.accessToken);
    localStorage.setItem('id_token', authResult.idToken);
    localStorage.setItem('profile', JSON.stringify(profile));

    updateUI();
  });
});

updateUI();

// Handle login
document.getElementById('btn-login').addEventListener('click', () => {
  lock.show();
});

// Handle logout
document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('id_token');
  localStorage.removeItem('access_token');
  localStorage.removeItem('profile');
  document.getElementById('btn-login').style.display = 'flex';
  document.getElementById('btn-logout').style.display = 'none';
  document.getElementById('nick').textContent = '';
});

// Handle public api call
// document.getElementById('btn-public').addEventListener('click', () => {
//   // call public API
//   fetch(PUBLIC_ENDPOINT, {
//     cache: 'no-store',
//     method: 'POST',
//   })
//     .then(response => response.json())
//     .then((data) => {
//       console.log('Message:', data);
//       document.getElementById('message').textContent = '';
//       document.getElementById('message').textContent = data.message;
//     })
//     .catch((e) => {
//       console.log('error', e);
//     });
// });

// Handle private api call
document.getElementById('btn-private').addEventListener('click', async () => {
  console.log('here');
  // Call private API with JWT in header
  const profile = JSON.parse(localStorage.getItem('profile'));
  const token = localStorage.getItem('id_token');
  // block request from happening if no JWT token present
  if (!token) {
    document.getElementById('message').textContent = '';
    document.getElementById('message').textContent =
      'You must login to call this protected endpoint!';
    return false;
  }
  const ipAddress = await fetch('https://api.ipify.org?format=json')
    .then((result) => result.json())
    .then((data) => {
      return data.ip;
    });
  console.log(ipAddress);
  // Do request to private endpoint
  fetch(PRIVATE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaseActive: true,
      leaseEnd: currentTime + 3600000,
      leaseStart: currentTime,
      name: profile.email,
      ip: `${ipAddress}/32`,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log('Token:', data);
      document.getElementById('message').textContent = '';
      document.getElementById('message').textContent = data.message;
    })
    .catch((e) => {
      console.log('error', e);
    });
});
