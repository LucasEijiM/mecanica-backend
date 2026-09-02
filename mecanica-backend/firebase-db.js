const admin = require('firebase-admin');
const serviceAccount = require('./mecsmart-e69c6-firebase-adminsdk-fbsvc-1c53cf5dac.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mecsmart-e69c6.firebaseio.com"
});

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };