const express = require('express')
const app = express()


var mysql = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
//  password : 'aws17Sql69',
  password : 'root',
  database : 'temp',
  multipleStatements: true,
  charset: "utf8"
});

// open connection to mysql
connection.connect(function(err){
if(!err) {
    console.log("Database is connected ... nn");
} else {
    console.log("Error connecting database ... nn");
}
});

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

// Query to get the book with isbn
function deleteBook(con, bookData, cb)
{
   console.log('Ready to DELETE');
   console.log(JSON.stringify(bookData, null, 4));

    var query = con.query('Delete books Where ? ', bookData,
        function(err, results) {
           if (err)
               return cb(err, null);
        });
    console.log(query.sql);
}


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
    console.log('Something is happening.');
    console.log('*****************************************************************');
    console.log(req.method);
    console.log('*****************************************************************');
    next(); // make sure we go to the next routes and don't stop here
});

router.route('/books')

    // create a book (accessed at POST http://localhost:3000/api/books)
    .post(function(req, res) {

        var bear = new Bear();      // create a new instance of the Bear model
        bear.name = req.body.name;  // set the bears name (comes from the request)

        // save the bear and check for errors
        bear.save(function(err) {
            if (err)
                res.send(err);

            res.json({ message: 'Book saved!' });
        });

    })

    // get all the bears (accessed at GET http://localhost:3000/api/books)
    .get(function(req, res) {
      console.log('In list GET, ready to get the list');
      getListBooks(connection, function(err, bookinfo) {
            if (err) {
              res.status(err).jsonp({error: "Error !! Error !!"});
              return console.error(err);
            }
            if (bookinfo != "") {
              // Found? send 200 + book information.
              console.log('Yup, found list: ');
              console.log('-->' +bookinfo+'<--');
              res.status(200).jsonp(bookinfo);
            }
            else {
              // Not found? send 404 back to client
              console.log('Nope, no list ??!!: ');
              res.status(404).end();
            }
      });
    });


    router.route('/books/:isbn')

      // update
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

        // get the book with that id (accessed at GET http://localhost:3000/api/books/:book_id)
        .get(function(req, res) {
            getBook(connection, req.params.isbn, function(err, bookinfo) {
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

        // delete the book with this id (accessed at DELETE http://localhost:8080/api/bears/:bear_id)
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

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function(req, res) {
      fs.readFile(__dirname + '/public/index.html', 'utf8', function(err, text){
          res.send(text);
      });
//      res.json({ message: 'hooray! welcome to our api!' });
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
