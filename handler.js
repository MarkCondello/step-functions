const AWS = require("aws-sdk"),
StepFunction = new AWS.StepFunctions(),
DynamoDB = require("aws-sdk/clients/dynamodb"),
documentClient = new DynamoDB.DocumentClient({
  region: 'ap-southeast-2',
  // maxRetries: 3,
  httpOptions: {
    timeout: 5000,
  },
})

const isBookAvailable = (book, quantity) => {
  return (book.quantity - quantity) > 0
}

module.exports.checkInventory = async ({ bookId, quantity }) => {
 try {
  const params = {
    TableName: "books",
    KeyConditionExpression: "bookId = :bookId",
    ExpressionAttributeValues: {
      ":bookId": bookId
    }
  }
  const result = await documentClient.query(params).promise(); // this is how we can make a get with query
  const book = result.Items[0];
  if (isBookAvailable(book, quantity)){
    return book
  } else {
    const bookOutOfStockError = new Error("The book is out of stock")
    bookOutOfStockError.name = "BookOutOfStock"
    throw bookOutOfStockError
  }
 } catch(error){
  if (error.name === "BookOutOfStock") {
    throw error
  } else {
    const bookNotFoundError = new Error(error)
    bookNotFoundError.name = "BookNotFound"
    throw bookNotFoundError
  }
 }
};

module.exports.calculateTotal = async ({ book, quantity }) => {
  const total = book.price * quantity
  // return total
  return { total }
};

const deductPoints = async (userId) => {
  let params = {
    TableName: "users",
    Key: {
      "userId": userId
    },
    UpdateExpression: 'SET points = :zero',
    ExpressionAttributeValues: {
      ':zero' : 0
    }
  }
  await documentClient.update(params).promise()
}
module.exports.redeemPoints = async ({ userId, total }) => { // total gets passed in with the ResultPath
  // console.log(total)
  let orderTotal = total.total
  try {
    let params = {
      TableName: "users",
      Key: {"userId": userId}
    }
    const result = await documentClient.get(params).promise() // this is the standard way to GET
    const user = result.Item
    const points = user.points

    if (orderTotal > points) {
      await deductPoints(userId)
      orderTotal = orderTotal - points
      return { total: orderTotal, points } // points is included if it is needed in the error catch block
    } else {
      throw new Error('Order total is less than redeem points')
    }
  } catch(error) {
    throw new Error(error)
  }
}

module.exports.billCustomer = async (params) => {
  // Bill the customer e.g. Using stripe from the params
  return `Successfully billed ${params.total.total}`
}

module.exports.restoreRedeemPoints = async ({userId, total}) => {
  try {
    if (total.points) {
      const params = {
        TableName: "users",
        Key: { userId : userId },
        UpdateExpression: 'set points = :points',
        ExpressionAttributeValues: {
          ':points' : total.points
        }
      }
     await documentClient.get(params).promise()
    }
  } catch(error) {
    throw new Error(error)
  }
}

const updateBookQuantity = async (bookId, orderQuantity) => {
  console.log("bookId: ", bookId);
  console.log("orderQuantity: ", orderQuantity);
  let params = {
      TableName: 'books',
      Key: { 'bookId': bookId },
      UpdateExpression: 'SET quantity = quantity - :orderQuantity',
      ExpressionAttributeValues: {
          ':orderQuantity': orderQuantity
      }
  };
  await documentClient.update(params).promise();
}
module.exports.sqsWorker = async (event) => {
  try {
      console.log(JSON.stringify(event));
      let record = event.Records[0];
      let body = JSON.parse(record.body);
      /** Find a courier and attach courier information to the order, THIS WOULD BE A THIRD PARTY API LIKE AUSPOST */
      let courier = "<courier email>";
      // update book quantity
      await updateBookQuantity(body.Input.bookId, body.Input.quantity);
      // throw "Something wrong with Courier API";
      // Attach curier information to the order
      await StepFunction.sendTaskSuccess({
          output: JSON.stringify({ courier }),
          taskToken: body.Token
      }).promise();
  } catch (e) {
      console.log("===== You got an Error =====");
      console.log(e);
      await StepFunction.sendTaskFailure({
          error: "NoCourierAvailable",
          cause: "No couriers are available",
          taskToken: body.Token
      }).promise();
  }
}

module.exports.restoreQuantity = async ({ bookId, quantity }) => {
  let params = {
    TableName: 'books',
    Key: { bookId: bookId },
    UpdateExpression: 'set quantity = quantity + :orderQuantity',
    ExpressionAttributeValues: {
      ':orderQuantity': quantity
    }
  };
  await documentClient.update(params).promise();
  return "Quantity restored"
}