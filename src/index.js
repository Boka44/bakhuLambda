const request = require('request')
const mongoose = require('mongoose');
const moment = require('moment');

let conn = null;
let Ticker = null;

const uri = `mongodb+srv://${process.env.dbUser}:${process.env.dbPassword}@cluster0-oj6p1.mongodb.net/bakhu?retryWrites=true&w=majority`;

exports.handler = async function main(event, context, lambdaCallback) {
  // Make sure to add this so you can re-use `conn` between function calls.
  // See https://www.mongodb.com/blog/post/serverless-development-with-nodejs-aws-lambda-mongodb-atlas
    context.callbackWaitsForEmptyEventLoop = false;

    // Because `conn` is in the global scope, Lambda may retain it between
    // function calls thanks to `callbackWaitsForEmptyEventLoop`.
    // This means your Lambda function doesn't have to go through the
    // potentially expensive process of connecting to MongoDB every time.
    if (conn == null) {
      conn = await mongoose.createConnection(uri, {
        // Buffering means mongoose will queue up operations if it gets
        // disconnected from MongoDB and send them when it reconnects.
        // With serverless, better to fail fast if not connected.
        bufferCommands: false, // Disable mongoose buffering
        bufferMaxEntries: 0, // and MongoDB driver buffering
        useUnifiedTopology: true,
        useNewUrlParser: true
      });
      console.log(conn.readyState);

      const Schema = mongoose.Schema;
      

      const tickerSchema = new Schema({
        createdAt: { type: Date },
        updatedAt: { type: Date },
        symbol: { type: String },
        latestPrice: { type: String }
      });

      tickerSchema.pre('save', function (next) {
        let ticker = this;
        
        this.createdAt = ticker.createdAt ? ticker.createdAt : moment().local();
        this.updatedAt = moment().local();
        
        next();
      })

      Ticker = conn.model('Ticker', tickerSchema);
    
      
  // })
    }
  const next = await runRequest(lambdaCallback);

};

function runRequest(lambdaCallback) {
  // const tickerController = require('./controllers/ticker');
  return new Promise((resolve, reject) => {

  
  request('https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=BKUH&apikey=' + process.env.apiKey, (err, response, body) => {
        if (err) {
          console.error(err);
          done(502, '{"message", "Error retrieving ticker data"}', 'application/json', lambdaCallback);
        } else {
          try {
            let response = JSON.parse(body),
            data = response["Global Quote"];
            let dataObj = {
                  symbol: data["01. symbol"],
                  latestPrice: data['05. price']
              }
              console.log(dataObj);
            tickerController.createOrUpdate(dataObj).then(() => {
              done(200, data, 'application/json', lambdaCallback);
              resolve()
            })
            
          } catch (e) {
            console.error(e);
            done(502, '{"message", "Error parsing ticker data"}', 'application/json', lambdaCallback);
            reject();
          }
        }
      });
    })
}

const tickerController = () => { };


tickerController.createOrUpdate = (data) => {
    return TickerMethod.findAllTickers()
    .then((result) => {
        console.log(result.length);
        if(result.length < 1) {
            const newDataObj = new Ticker(data);
            console.log('Saving new data')
            console.log(newDataObj);
            newDataObj.save()
            .then((result) => {
                console.log(result);
                return;
            })
            .catch((err) => {
                return err;
            })
        } else {
            console.log('call editTicker')
            data.updatedAt = moment().local();
            return TickerMethod.editTicker(data)
            .then((result) => {
                    console.log(result);
                    return;
                })
                .catch((err) => {
                    return err;
                })
        }
        
        
    })
}

const TickerMethod = () => { };


TickerMethod.findAllTickers = () => {
	console.log('findAllTickers exec');
	return new Promise((resolve, reject) => {
		console.log(Ticker.db.readyState);
		Ticker.find()
		.exec((err, result) => {
			if(err) {
				console.log('err : ');
				console.log(err);
				return reject(err);
			}
			console.log('result : ');
			console.log(result);
			 return resolve(result);
		})
	})
}

TickerMethod.editTicker = (ticker) => {
	return new Promise((resolve, reject) => {
		Ticker.findOneAndUpdate({symbol: ticker.symbol}, ticker)
		.exec((err, result) => {
			if(err) return reject(err);
			resolve(result);
		})
	})
}


// We're done with this lambda, return to the client with given parameters
function done(statusCode, body, contentType, lambdaCallback, isBase64Encoded = false) {
  lambdaCallback(null, {
    statusCode: statusCode,
    isBase64Encoded: isBase64Encoded,
    body: body,
    headers: {
      'Content-Type': contentType
    }
  });
}
