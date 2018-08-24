const express = require('express')
const app = express()
const crypto = require('crypto');

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

function saveToken(con, data, cb) {
  data=JSON.parse(data);
  var token=JSON.parse(data.token_data);

//  var token = data.token_data;
//  console.log('Token is :'+JSON.stringify(token, null, 4));
  var mediatable=Object.keys(token)[0];
  var token_id=Object.values(token)[0];
  var new_user="";
  mediatable=mediatable.substring(0, mediatable.length - 3);
  // First check if we already have this token in table
  var query = con.query('SELECT user_profile_id FROM '+mediatable+'_account WHERE '+mediatable+'_id = ? ', [token_id],
    function(err, results) {
       if (err)
           return cb(err, null);
       // check to see if user is already in db
       if (results.length == 0) {
         // we don't have, so lets create an empty record for the user
         // we need it, since we need the user_profile_id in order
         // to insert our token in our social media table
         var query2 = con.query('INSERT INTO user_profile (first_name) values("")',
             function(err, results) {
                if (err)
                    return cb(err, null);
                var new_user=results.insertId;
                token.user_profile_id=new_user;
                // now that we have the profile_id, we will insert into the
                // respective socialmedia table, both the profile_id and the socialmedia id
                var query3 = con.query('INSERT INTO '+mediatable+'_account SET ? ', [token],
                    function(err, results) {
                       if (err)
                           return cb(err, null);
                    }
                  );
              });
        }
        else {
//          console.log("Our query produced: "+JSON.stringify(results, null, 4));
          if (!(results === undefined || results.length == 0)) {
              if ("user_profile_id" in results[0]) {
                new_user = results[0].user_profile_id;
              }
          }
        }
//       console.log('3.'+query.sql);
       return cb(null, new_user);
    }
  );
}

// ============================================================
// Thoughts!
// if we delete the token from the social media, when the user
// logs back in, how will we 'know' him and be able to link his
// profile to the social media login ?
// Should we delete the tokens?

function deleteToken(con, token, cb)
{
   console.log('Ready to DELETE');
   console.log(JSON.stringify(token, null, 4));

    var query = con.query('Delete books Where ? ', bookData,
        function(err, results) {
           if (err)
               return cb(err, null);
        });
    console.log(query.sql);
}

// This is to update the users profile in the DB`
// Receive
//      profile_data= { email : email,
//                      password: password
//                    }
// Notes
// post === insert
function postProfile(con, data, cb) {
  console.log("Inserting new user");
  // called when we login with email/pwd
  // First, check whether email is already registered
  // Yes, return error
  // No, return success (message that we sent email for confirmation)
  data=JSON.parse(data);
  var profile=JSON.parse(data.profile_data);

  var password=profile.password;

  var salt = genRandomString(64); /** Gives us salt of length 64 */
  var passwordData = sha512(password, salt);
  profile.password = passwordData.passwordHash;
  profile.password_salt = passwordData.salt;

  var regreso = {id : "", msg : ""};
  console.log("Profile: "+JSON.stringify(profile, null, 4));
  var query = con.query('SELECT count(*) as existe FROM user_profile '+
                        'WHERE email = ? ',
                        [profile.email],
       function(err, results) {
          if (err) {
             console.log(err);
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
                       console.log(err);
                       return cb(err, null);
                     }
                     regreso.id=results.insertId;
               });

             }
             else {
               regreso.msg="email is use";
             }
          }
          return cb(null, regreso);
       });
}

// This is to update the users profile in the DB`
// Receive
//      profile_data= { profile_id : profile_id,
//                      first_name: first_name,
//                      last_name: last_name,
//                      user_email : email
//                    }
// Notes
// post === insert
// put === update
function putProfile(con, profile_id, data, cb) {
  data=JSON.parse(data);
  var profile=JSON.parse(data.profile_data);

  // First update user_profile table
  console.log("Profile: "+JSON.stringify(profile, null, 4));
  var query = con.query('UPDATE user_profile SET first_name = ?, '+
                        'last_name = ?, email = ? WHERE ? ',
                        [profile.first_name, profile.last_name,
                         profile.email, {id: profile.user_profile_id}],
       function(err, results) {
          if (err) {
             console.log(err);
             return cb(err, null);
           }
       });
   // Now, if record does not exist in user account, create it !
   // otherwise, update it
//   console.log(query.sql);
   var query = con.query('SELECT user_profile_id FROM user_account WHERE ?', {user_profile_id: profile.user_profile_id},
     function(err, results) {
        if (err) {
           console.log(err);
           return cb(err, null);
        }
        if (!(results === undefined || results.length == 0)) {
            if ("user_profile_id" in results[0]) {
              // exists, so update
              var query = con.query('UPDATE user_account '+
                                    'SET email = ? '+
                                    'WHERE ? ',
                                    [profile.email, {user_profile_id: profile.user_profile_id}],
                   function(err, results) {
                      if (err) {
                         console.log(err);
                         return cb(err, null);
                       }

                   });
            }
          }
            else {
              // no exists, on insert
              var query = con.query('INSERT into user_account SET user_profile_id = ?, '+
                                    'email = ?  ', [profile.user_profile_id, profile.email],
                function(err, results) {
                   if (err) {
                      console.log(err);
                      return cb(err, null);
                    }

              });
            }
      });

  return cb(null, null);
}

// This is to update the user profile password in the DB`
// Receive
//      profile_data= { password : password
//                    }
// Notes
//
//   Will add fields {password_salt: salt} and
//   replace the password by user with hashed password
//
function saveProfilePwd(con, profile_id, data, cb) {
  data=JSON.parse(data);
  var profile=JSON.parse(data.profile_data);
  console.log("Profile: "+JSON.stringify(profile, null, 4));

  // First we need to protect user password
  // We will generate a random salt to apply to
  // users password.
  // Once we've hashed password, we will add the field
  // of salt (we need it to check password in future)
  // and we will change users password for the hashed version

  var password=profile.password;

  var salt = genRandomString(64); /** Gives us salt of length 16 */
  var passwordData = sha512(password, salt);
  profile.password = passwordData.passwordHash;
  profile.password_salt = passwordData.salt;

  // We are ready, continue.
  // First update user_profile table
  console.log("Profile: "+JSON.stringify(profile, null, 4));
  var query = con.query('UPDATE user_account '+
                        'SET ? '+
                        'WHERE ? ',
                        [profile, {user_profile_id: profile_id}],
       function(err, results) {
          if (err) {
             console.log(err);
             return cb(err, null);
           }

       });
  console.log(query.sql);

  return cb(null, null);
}


function getProfile(con, profile_id, cb) {
  // Get profile info form both tables
  var query = con.query('SELECT up.first_name, up.last_name, up.full_name, up.email, '+
                                'up.accept_terms_of_service, up.time_zone, ua.user_name, '+
                                'ua.email, ua.password, ua.password_salt, ua.password_reminder_token, '+
                                'ua.password_reminder_expire, ua.email_confirmation_token, '+
                                'ua.user_account_status_id '+
                        'FROM  user_profile up, user_account ua '+
                        'WHERE up.id = ua.user_profile_id '+
                        '  AND up.id = ? '
                        , [profile_id],
        function(err, results) {
           if (err) {
              console.log(err);
              return cb(err, null);
           }
            return cb(null, results[0]);
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


router.route('/token')
    // Access point POST http://host:3000/api/token
    // Receive
    //      token_data= { media_id : token_id }
    // media_id can be "google_id", "facebook_id", "twitter_id", etc
    //
    // Return
    //      id   (id for lanista app)
    //
    // Notes
    //    If no profile exists for -new- user, then an empty one will be created
    //   by this call. (In order to generate the id)

    .post(function(req, res) {

        console.log('Data from /token/POST is :'+JSON.stringify(req.body, null, 4));
        var token = JSON.stringify(req.body);

        saveToken(connection, token, function(err, id) {
              if (err) {
                res.status(err).jsonp({error: "Error !! Error !!"});
                return console.error(err);
              }
              if (id != "") {
                // Found? send 200 + profile id information.
                console.log('Yup, generated id : '+id);
                res.status(200).jsonp(id);
              }
              else {
                // Not found? send 404 back to client
                console.log('Nope, no id ??!!: ');
                res.status(404).end();
              }
        });

    });


router.route('/token/:token')

    // get token ?? make sense? if you know the token, why get it?
    // get token GET http://host:8080/api/token/:token_id)
    .get(function(req, res) {
        getToken(connection, req.params.token, function(err, bookinfo) {
              if (err) {
                res.status(err).jsonp({error: "Error !! Error !!"});
                return console.error(err);
              }
              if (bookinfo != "") {
                // Found? send 200 + book information.
                console.log('Yup, found it: ' +req.params.isbn);
                console.log('-->' +bookinfo+'<--');
                res.status(200).jsonp(bookinfo);
              }
              else {
                // Not found? send 404 back to client
                console.log('Nope, not found: ' +req.params.isbn);
                res.status(404).end();
              }
        });
    })

    // delete token DELETE http://host:8080/api/token/:token_id)
    .delete(function(req, res) {
      deleteToken(connection, req.params.token, function(err, tokeninfo) {
            if (err) {
              res.status(err).jsonp({error: "Error !! Error !!"});
              return console.error(err);
            }
            if (tokeninfo == "") {
              console.log('Deleted !!!  ' +req.params.token);
              res.status(200).end();
            }
      });
    });

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

        console.log('Data from /profile/POST is :'+JSON.stringify(req.body, null, 4));
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
      // Access point POST http://host:3000/api/profile/
      // Receive
      //                    }
      //
      // Return
      //
      // Notes

        console.log('Data from /profile/POST is :'+JSON.stringify(req.body, null, 4));
        var info = JSON.stringify(req.body);

        postProfile(connection, info, function(err, id) {
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


// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);
