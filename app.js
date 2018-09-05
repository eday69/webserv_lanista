const express = require('express')
const app = express()
const crypto = require('crypto');
'use strict';
const nodemailer = require('nodemailer');

/**
 * hash password with sha512.
 * @function
 * @param {string} password - List of required fields.
 * @param {string} salt - Data to be validated.
 */
var sha512 = function(password, salt){
    var hash = crypto.createHmac('sha512', salt); /** Hashing algorithm sha512 */
    hash.update(password);
    var value = hash.digest('hex');
    return {
        salt:salt,
        passwordHash:value
    };
};
var genRandomString = function(length){
    return crypto.randomBytes(Math.ceil(length/2))
            .toString('hex') /** convert to hexadecimal format */
            .slice(0,length);   /** return required number of characters */
};


var mysql = require('mysql');
var connection = mysql.createConnection({
  host     : 'lanista.corpezvndhea.us-east-2.rds.amazonaws.com',
  user     : 'master',
  password : '1calgary4ever!',
  database : 'lanista',
  multipleStatements: true,
  charset: "utf8"
}); // port 3306?

// open connection to mysql
connection.connect(function(err){
if(!err) {
    console.log("Database is connected ... nn");
} else {
    console.log("Error connecting database ... nn");
}
});



// Access point POST http://host:3000/api/profile
// Receive (two options)
// 1)
//      { social_media : token_id,
//        social_media_token: social_media_token,
//        last_name: last_name,
//        first_name: first_name,
//        email : email }
// media_id can be "google_id", "facebook_id", "twitter_id", etc
//
// 2)   { email: email, password: password }
// Returns
//      {
//        id : id,     (id for lanista app)
//        user_account_status_id: user_account_status_id
//      }
//
// Notes
//    If no profile exists for -new- user, then an empty one will be created
//   by this call. (In order to generate the id)
function postProfile(con, data, cb) {
  var profile=JSON.parse(data);
  var regreso = {};
  if ('social_media' in profile) {
    var mediatable=profile.social_media;
    var token_id=profile.social_media_token;
    mediatable=mediatable.substring(0, mediatable.length - 3);
    var query = con.query('SELECT user_profile_id FROM '+mediatable+'_account WHERE '+mediatable+'_id = ? ', [token_id],
      function(err, results) {
         var new_user='';
         if (err) return cb(err, null);
         // check to see if user is already in db
         console.log(query.sql);
         if (results.length == 0) {
           // we don't have, so lets create an new profile record for the user
           // we need it, since we need the user_profile_id in order
           // to insert our token in our social media table
           var query2 = con.query('INSERT INTO user_profile (first_name, last_name, '+
                                  'email, user_account_status_id) VALUES(?,?,?,40)',
                                  [profile.user_first_name,profile.user_last_name,profile.email],
               function(err, results) {
                  if (err)
                      return cb(err, null);
                  new_user=results.insertId;
                  console.log('New id is : '+new_user);
                  // now that we have the profile_id, we will insert into the
                  // respective socialmedia table, both the profile_id and the socialmedia id
                  var mSocialmedia = {};
                  mSocialmedia[profile.social_media]=profile.social_media_token;
                  mSocialmedia['user_profile_id']=new_user;
                  var query3 = con.query('INSERT INTO '+mediatable+'_account SET ? ',
                      [mSocialmedia],
                      function(err, results) {
                         if (err) {
                             return cb(err, null);
                         }
                  });
//                  console.log(query3.sql);
                  // got lanista id for token, return it
                  regreso.id=new_user;
                  regreso.msg="";
                  return cb(null, regreso);
            });
          }
          else {
            if (!(results === undefined || results.length == 0)) {
                if ("user_profile_id" in results[0]) {
                  // Token already existed in db. This means Authorization
                  // we have lanista id in db !
                  // got lanista id for token, return it
                  regreso.id=results[0].user_profile_id;
                  regreso.msg="";
                  return cb(null, regreso);
                }
            }
          }
      }
    );

// ok
  }
  else {  // Not a social media login, then an email login
    var password=profile.password;
    var salt = genRandomString(64); /** Gives us salt of length 64 */
    var passwordData = sha512(password, salt);
    profile.password = passwordData.passwordHash;
    profile.password_salt = passwordData.salt;
    profile.user_account_status_id = 20;

    var query = con.query('SELECT count(*) as existe FROM user_profile '+
                          'WHERE email = ? ',
                          [profile.email],
         function(err, results) {
            if (err) {
               return cb(err, null);
            }
            if (!(results === undefined || results.length == 0)) {
               if ("existe" in results[0]) {
                 var existe = results[0].existe;
               }
               if (existe == 0) {  // Does not exist !
                 var query = con.query('INSERT into user_profile SET ?  ', [profile],
                   function(err, results) {
                      if (err) {
                         return cb(err, null);
                       }
//                       console.log('Results id :'+results.insertId)
                       regreso.id=results.insertId;
                       regreso.msg="";
                       return cb(null, regreso);
                 });
               }
               else {
                 regreso.id="";
                 regreso.msg="email in use";
                 return cb(null, regreso);
               }
            }
         });

  }
}

// This is to update the users profile in the DB`
// Receive
//                   {
//                     first_name: first_name,
//                     last_name: last_name,
//                     user_role_id : role,
//                     user_dob : user_date_of_birth
//                    }
// for :profile_id
//
// Return
//            { user_account_status_id }
// Notes
// post === insert
// put === update
function putProfile(con, profile_id, data, cb) {
  var profile=JSON.parse(data);
//  var profile=JSON.parse(data.profile_data);

  // First update user_profile table
  console.log("Profile: "+JSON.stringify(profile, null, 4));
  var query = con.query('UPDATE user_profile SET ? WHERE ? ',
                        [profile, {id: profile_id}],
       function(err, results) {
          if (err) {
             console.log(err);
             return cb(err, null);
          }
          // We've update fields in user profile table.
          // Should probably check if info is complete, then
          // update user_account_status_id to 100 (if complete)
          // otherwise we could return a different status
          // What is complete? (Name, email, role, dob?)
          //
          var query = con.query('SELECT user_account_status_id '+
                                'FROM user_profile WHERE ?  ',
                                [{id: profile_id}],
            function(err, results) {
               if (err) {
                  console.log(err);
                  return cb(err, null);
                }
                return cb(null, {user_account_status_id: results[0].user_account_status_id});
          });
//          console.log(query.sql);
       });
}


function getProfile(con, profile_id, cb) {
  // Get profile info form both tables
  var query = con.query('SELECT first_name, last_name, full_name, email, '+
                               'accept_terms_of_service, time_zone, '+
                               'user_account_status_id, user_role_id, user_dob '+
                        'FROM   user_profile  '+
                        'WHERE id = ? '
                        , [profile_id],
        function(err, results) {
           if (err) {
              console.log(err);
              return cb(err, null);
           }
            return cb(null, results[0]);
        });
}

// Login process. We validate email & password credentials
// against data in db
// Receive
//      { email : email,
//        password: password }
// Return
//      { id: id,
//        user_account_status_id: user_account_status_id}
// Notes
function validateLogin(con, user, cb) {
  console.log("Getting user");
  var user=JSON.parse(user);
//  var profile=JSON.parse(data.profile_data);

  var password=user.password;

  var return_info = {};
  var query = con.query('SELECT id, password, password_salt, '+
                        'first_name, last_name, user_account_status_id '+
                        'FROM user_profile '+
                        'WHERE email = ?  ', [user.email],
    function(err, results) {
       if (err) {
          console.log(err);
          return cb(err, null);
        }
        if (!((results === undefined) || (results.length == 0))) {
           if ("id" in results[0]) {
             var password_db = results[0].password;
             var password_salt = results[0].password_salt;

             return_info.id = results[0].id;
//             return_info.first_name = results[0].first_name;
//             return_info.last_name = results[0].last_name;
             return_info.user_account_status_id = results[0].user_account_status_id;

             var passwordData = sha512(password, password_salt);
//             console.log(passwordData, password,
//               password_db, password_salt);
//             console.log(query.sql);

             if (password_db == passwordData.passwordHash) {
               // correct credentials
               return cb(null, return_info);
             }
             else {
               // credentials are wrong
               return cb(null, {id: null, msg: "Wrong credentials !"});
             }

           }
         }
         else {
           // user not found
           return cb(null, {id: null, msg: "User not found !"});
         }
       });
}

// API Get Roles
// Return
//      { id: id,
//        roles: roles }
// Notes
function getRoles(con, cb) {
//  console.log("Getting roles");
  var query = con.query('SELECT id, role '+
                        'FROM user_roles ', [],
    function(err, results) {
       if (err) {
          return cb(err, null);
        }
//        console.log(query.sql);
//        console.log(results);

        return cb(null, results);
    });
}

/*
// Query to get a list of books
function getListBooks(con, cb)
{
    con.query('SELECT isbn, titulo, autor, fecha_pub, precio_lista '+
              'FROM books AS r1 JOIN '+
              '(SELECT CEIL(RAND() * '+
                     '(SELECT MAX(id) '+
                     ' FROM books)) AS id) AS r2 '+
              'WHERE r1.id >= r2.id '+
              'ORDER BY r1.id ASC '+
              'LIMIT 15 ',
    function(err, results, fields) {
       if (err)
           return cb(err, null);
       var mytemp=JSON.stringify(results);
       console.log(mytemp);
       cb(null, results);
  });
}


// Query to get the book with isbn
function getBook(con, isbn, cb)
{
    con.query('select isbn, titulo, autor, fecha_pub, precio_lista '+
              'from books '+
              'where isbn = "'+isbn+'";',
    function(err, results, fields) {
       if (err)
           return cb(err, null);
       console.log('Searching for a book...results: ');
       var mytemp=JSON.stringify(results);
       console.log(mytemp);
       cb(null, results);
  });
}

// Query to get the book with isbn
function saveBook(con, bookData, cb)
{
   console.log('Ready to save, but first check if it exists');
   console.log(JSON.stringify(bookData, null, 4));

   var query = con.query('SELECT count(*) as tot FROM books Where ? ', {isbn: bookData.isbn},
        function(err, results) {
           if (err) {
              console.log(err);
              return cb(err, null);
            }
           console.log(results[0].tot);
           if (results[0].tot > 0) {
             var query = con.query('Update books SET ? Where ? ', [bookData, {isbn: bookData.isbn}],
                  function(err, results) {
                     if (err) {
                        console.log(err);
                        return cb(err, null);
                      }
                  });
                  console.log(query.sql);
            }
            else {
              var query = con.query('INSERT into books SET ? ', [bookData, {isbn: bookData.isbn}],
                   function(err, results) {
                      if (err) {
                         console.log(err);
                         return cb(err, null);
                       }
                   });
                   console.log(query.sql);
            }
        });
}

*/

var bodyParser = require('body-parser');

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 3000;        // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// middleware to use for all requests
router.use(function(req, res, next) {
    // do logging
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT,DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    console.log('*****************************************************************');
    console.log(req.method);
    console.log('*****************************************************************');
    next(); // make sure we go to the next routes and don't stop here
});

// Routes defined
// for: profile
//  --> POST
// for: token
//  --> POST
// for: token/:token





router.route('/profile/:profile_id')

    .put(function(req, res) {
      // Access point PUT http://host:3000/api/profile/:profile_id
      // Update user profile
      // Receive
      //      profile_data= { profile_id : profile_id,
      //                      user_name : name,
      //                      user_email : email
      //                    }
      //
      // Return
      //      id   (id for lanista app)
      //
      // Notes

        console.log('Data from /profile/PUT is :'+JSON.stringify(req.body, null, 4));
        var info = JSON.stringify(req.body);

        putProfile(connection, req.params.profile_id, info, function(err, id) {
              if (err) {
                res.status(err).jsonp({error: "Error !! Error !!"});
                return console.error(err);
              }
              if (id != "") {
                // Found? send 200 +  information.
                console.log('Yup, updated profile id : '+id);
                res.status(200).jsonp(id);
              }
              else {
                // Not found? send 404 back to client
                console.log('Nope, no id ??!!: ');
                res.status(404).end();
              }
        });

    })
/*
      // update the user profile
      // Here we update fields like name, last name, etc
      .put(function(req, res) {
        console.log('In put, ready to save');

        saveBook(connection, req.body, function(err, operResult) {
              if (err) {
                res.status(err).jsonp({error: "Error !! Error !!"});
                return console.error(err);
              }
              if (operResult == "") {  // Nothing is good.
                console.log('Yup, saved it ');
                console.log('-->' +operResult+'<--');
                res.status(204).end();
              }
              else {
                console.log('Nope,could not save: ' +operResult);
                res.status(400).end();
              }
        });
    })
*/
        // get profile (accessed at GET http://host:3000/api/profile/:profile_id)
        .get(function(req, res) {
            getProfile(connection, req.params.profile_id, function(err, profileinfo) {
                  if (err) {
                    res.status(err).jsonp({error: "Error !! Error !!"});
                    return console.error(err);
                  }
                  if (profileinfo != "") {
                    // Found? send 200 + book information.
                    res.status(200).jsonp(profileinfo);
                  }
                  else {
                    // Not found? send 404 back to client
                    console.log('Nope, profile not found: ' +req.params.profile_id);
                    res.status(404).end();
                  }
            });
        })
/*
        // delete the profile (DELETE http://host:8080/api/profile/:profile_id)
        .delete(function(req, res) {
          deleteBook(connection, req.params.isbn, function(err, bookinfo) {
                if (err) {
                  res.status(err).jsonp({error: "Error !! Error !!"});
                  return console.error(err);
                }
                if (bookinfo == "") {
                  // Found? send 200 + book information.
                  console.log('Deleted !!!  ' +req.params.isbn);
                  res.status(200).end();
                }
          });
        });
*/
router.route('/profile')

    .post(function(req, res) {
      // Post of profile is to create a lanista id when user decides to login
      // either using his email/pwd combo or a social media token.
      //
      // Access point POST http://host:3000/api/profile/
      // Receive
      //                    }
      //
      // Return
      //
      // Notes

        console.log('Data from /profile/POST is :'+JSON.stringify(req.body, null, 4));
        var info = JSON.stringify(req.body);

        postProfile(connection, info, function(err, regreso) {
              if (err) {
                res.status(err).jsonp({error: "Error !! Error !!"});
                return console.error(err);
              }
              if (regreso != "") {
                // Found? send 200 +  information.
//                console.log('Result from POST is :'+JSON.stringify(regreso, null, 4));
                res.status(200).jsonp(regreso);
              }
              else {
                // Not found? send 404 back to client
                console.log('Nope, no id ??!!: ');
                res.status(404).end();
              }
        });

    });
  router.route('/validateLogin')

      .post(function(req, res) {
        // Access point POST http://host:3000/api/login/
        // Receive { email: email, password: password }
        //
        // Return { id : id,
        //          first_name : first_name,
        //          last_name : last_name,
        //          full_name : full_name,
        //          user_account_status_id : user_account_status_id }
        //
        // Notes

          console.log('Data from /validateLogin/POST is :'+JSON.stringify(req.body, null, 4));
          var info = JSON.stringify(req.body);

          validateLogin(connection, info, function(err, regreso) {
                if (err) {
                  res.status(err).jsonp({error: "Error !! Error !!"});
                  return console.error(err);
                }
                if (regreso.id != null) {
                  // Found? send 200 +  information.
//                    console.log('Result from POST is :'+JSON.stringify(regreso, null, 4));
                  res.status(200).jsonp(regreso);
                }
                else {
                  // Not found? send 404 back to client
                  res.status(203).jsonp(regreso);
                }
          });

      });
      router.route('/roles')

          .get(function(req, res) {
            // Access point GET http://host:3000/api/roles/
            // Return { id : id,
            //          role : role }
            //
            // Notes

              console.log('Data from /login/GET is :'+JSON.stringify(req.body, null, 4));
              var info = JSON.stringify(req.body);

              getRoles(connection, function(err, regreso) {

/*
              connection.query("SELECT * FROM user_roles ", [], function (error, results, fields) {
                  if (error) throw error;
                  return res.send({ results });
              });
*/

                    if (err) {
                      res.status(err).jsonp({error: "Error !! Error !!"});
                      return console.error(err);
                    }
                    res.status(200).jsonp(regreso);
              });

          });

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function(req, res) {
//      fs.readFile(__dirname + '/public/index.html', 'utf8', function(err, text){
//          res.send(text);
//      });
      res.json({ message: 'hooray! welcome to our api!' });
});

// more routes for our API will happen here

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);
app.use(express.static(__dirname + '/public'));

/*
console.log('Sending message');

let transporter = nodemailer.createTransport({
    host: 'aspmx.l.google.com',
    port: 587,
    auth: {
        user: 'eric.ch.day@gmail.com',
        pass: 'eday1969'
    },
    tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false
    }
});

let mailOptions = {
      from: 'eric.ch.day@gmail.com',
      to: 'eric.ch.day@gmail.com',
      subject: 'Message test`',
      text: 'I hope this message gets delivered!',
      html: '<b>Hello world?</b>' // html body
   };

transporter.sendMail(mailOptions, (err, info) => {
  if (err) {
      return console.log(err);
  }
  console.log('Message sent: %s', info.messageId);
});

*/


// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);
