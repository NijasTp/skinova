const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema'); // Adjust the path to your User model
const env = require('dotenv').config();
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
try {
    let user = await User.findOne({ googleId: profile.id });
    if (user) {
       return done(null, user);
    } else {
        user = new User({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value
        });
        await user.save();
        done(null, user);
    }
} catch (error) {

    return done(error, null);
}
}));

passport.serializeUser((user, done) => {
    done(null, user.id);

});

passport.deserializeUser((id, done) => {
    User.findById(id)
    .then((user) => {
        done(null, user);
    })
    .catch((err) => {
        done(err, null);
    });
})

module.exports = passport;