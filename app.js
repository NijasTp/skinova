var createError = require('http-errors');
var express = require('express');
var path = require('path');
const hbs=require('hbs');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const connectDB = require('./config/connectdb');
var userRouter = require('./routes/user');
var adminRouter = require('./routes/admin');
const session = require('express-session');
const env = require('dotenv').config();
const passport = require('./config/passport');
const ejs=require('ejs')
connectDB();
var app = express();
app.use(
  session({
    secret: 'your-secret-key', 
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null; 
  next();
});

app.get('/pageNotFound',(req,res)=>{
  res.render('user/fourofour');
});
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');






app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', userRouter);
app.use('/admin', adminRouter);

// error handler
// app.use(function(err, req, res, next) {
//   // set locals, only providing error in development
//   res.locals.message = err.message;
//   res.locals.error = req.app.get('env') === 'development' ? err : {};

//   // render the error page
//   res.status(err.status || 500);
//   res.render('error');
// });

app.use(passport.initialize());
app.use(passport.session());



app.listen(3000, () => {
  console.log('Server is running on port 3000')
})
