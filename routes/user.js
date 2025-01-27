var express = require('express');
var router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client('147865379959-95uep5flk15e1f6eputi0lu4p4sjdqts.apps.googleusercontent.com');

// router.get('/', function(req, res) {
//   res.render('home');
// });


/* GET home page. */
router.get('/login', (req, res, next)=>{
  res.render('login');
});


router.post('/auth/google', async (req, res) => {
  const token = req.body.credential; // Token from Google Sign-In button
  console.log(token);

  try {
      const ticket = await client.verifyIdToken({
          idToken: token,
          audience: '147865379959-95uep5flk15e1f6eputi0lu4p4sjdqts.apps.googleusercontent.com',
      });
      const payload = ticket.getPayload();

      // Extract user details
      const userId = payload['sub'];
      const email = payload['email'];
      const name = payload['name'];

      // Here, you would typically save the user info to the session or database
      // For simplicity, we'll just store the user's email in the session
      req.session.user = { userId, email, name };

      console.log({ userId, email, name });

      // Redirect to home page after successful login
      res.redirect('/');
  } catch (error) {
      console.error('Error verifying token:', error);
      res.status(400).json({ error: 'Invalid token' });
  }
});

module.exports = router;
