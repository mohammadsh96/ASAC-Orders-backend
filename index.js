const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config()
const cors = require('cors');
const twilio = require('twilio');
const accountSid = process.env.TWILIO_ACCOUNT_SID ;
const authToken = process.env.TWILIO_AUTH_TOKEN ;
const clientz = twilio(accountSid, authToken);
// console.log(accountSid ,authToken);
// const { body, validationResult } = require('express-validator');
const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect('mongodb+srv://mohammadsh:PZqQNe0yM9qtXAWx@mohammadshcluster.bjrwqjp.mongodb.net/?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
});
const User = mongoose.model('User', userSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
  name: String,
  food: String,
  quantity: Number,
  price: Number,
  paymentStatus: {
    type: String,
    default: 'unPaid'
  },
  approved: {
    type: Boolean,
    default: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

const Order = mongoose.model('Order', orderSchema);
const externalOrderSchema = new mongoose.Schema({
  email: {
    type: String,
    default: 'mhmd.shrydh1996@gmail.com',
  },
  numberOfExternalOrders: {
    type: Number,
    default: 0,
  },
});
const ExternalOrder = mongoose.model('ExternalOrder', externalOrderSchema);
app.put('/external-orders', async (req, res) => {
  try {
    let { increment } = req.body;
    increment=parseInt(increment)
    console.log(increment);
    const externalOrder = await ExternalOrder.findOne();

    if (!externalOrder) {
      return res.status(404).json({ message: 'External order not found' });
    }

    if (increment && typeof increment === 'number' && increment >= 0) {
      externalOrder.numberOfExternalOrders = increment;
     await externalOrder.save();
   
    }else if(increment == 0){
      console.log('hello 00');
      externalOrder.numberOfExternalOrders = increment;
     await externalOrder.save();
    }

    res.json(externalOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating number of external orders' });
  }
});
app.get('/external-orders', async (req, res) => {
  
  try {
    const externalOrder = await ExternalOrder.findOne({ email: 'mhmd.shrydh1996@gmail.com' });

    if (!externalOrder) {
      return res.status(404).json({ message: 'External order not found' });
    }
    
       res.json(externalOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating number of external orders' });
  }
});
// Helper function to validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Middleware to validate token
function validateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token is required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decodedToken = jwt.verify(token, 'secretKey');
    req.userId = decodedToken.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Register User
app.post('/signup', async (req, res) => {
  console.log(req.body);
  try {
    const { name, email, password } = req.body;

    if (!name) {
      return res.status(400).json({ errors: [{ type: 'field', msg: 'Name is required', path: 'name', location: 'body' }] });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ errors: [{ type: 'field', msg: 'Invalid email format', path: 'email', location: 'body' }] });
    }

    if (!password) {
      return res.status(400).json({ errors: [{ type: 'field', msg: 'Password is required', path: 'password', location: 'body' }] });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(name, email, password);

    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Login User
app.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ errors: [{ type: 'field', msg: 'Invalid email format', path: 'email', location: 'body' }] });
    }

    if (!password) {
      return res.status(400).json({ errors: [{ type: 'field', msg: 'Password is required', path: 'password', location: 'body' }] });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    const token = jwt.sign({ userId: user._id }, 'secretKey');
    res.json({ token,user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Create Order
app.post('/orders', validateToken, async (req, res) => {
  try {
    
    const { food, quantity, price } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const order = {
      name: user.name,
      food,
      quantity,
      price,
      paymentStatus: 'unPaid',
      approved: false,
      userId,
    };
    await Order.create(order);
    
    res.status(201).json({ message: 'Order created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating order' });
  }
});


// Get All Orders
app.get('/orders', async (req, res) => {
  try {
    // const userId = req.userId;
    let arr ='' 
    const orders = await Order.find();
  
    res.json(orders);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving orders' });
  }
});
app.get('/send-calculations', async (req, res) => {
  try {
    // const userId = req.userId;
    let arr ='' 
    const orders = await Order.find();
    const Eorders = await ExternalOrder.find();
    let count=0
    for (let i = 0; i < orders.length; i++) {
       if(orders[i].food=='I am Good'){
        count++
       }
      
    }
    let totalNumOrders=parseInt(Eorders[0].numberOfExternalOrders) + parseInt(orders.length-count)
    const incrementValues = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00, 2.00, 2.00, 2.00];

    let incrementIndex = (2 / totalNumOrders)

    for (let i = 0; i < incrementValues.length; i++) {

      if (incrementIndex >= incrementValues[i] && incrementIndex < incrementValues[i + 1]) {
        if (incrementIndex === incrementValues[i]) {

          incrementIndex = incrementValues[i]
        } else {
          incrementIndex = incrementValues[i + 1]

        }
        break;
      }


    }

    // let del=2/parseInt(total)
    console.log(totalNumOrders);

    // console.log(orders.length);
    // console.log(Eorders[0].numberOfExternalOrders);
    console.log(incrementIndex);
    let arrFoods =''
    for (let i = 0; i < orders.length; i++) {
      let order =orders[i]
      if(order.food !=='I am Good'){

        let msg = `💲${order.name}:${(order.price+incrementIndex).toFixed(2)} \n `; 
       arrFoods+=`${order.name}:${order.food}\n`
        arr+=msg
      }
    }
    res.json(orders);

if(orders){
  try {
    clientz.messages
    .create({
       from: 'whatsapp:+14155238886',
       body: arr +arrFoods,
       to: 'whatsapp:+962795956190',
       username: 'mhmd.shrydh1996@gmail.com'
  
     })
    .then(message => console.log(message));
  } catch (error) {
    console.log(error);
  }

}


  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving orders' });
  }
});
// Update Order by ID
app.put('/orders/:id', validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, food, quantity, price , paymentStatus} = req.body;
    const userId = req.userId;

    if (!name) {
      return res.status(400).json({ errors: [{ type: 'field', msg: 'Name is required', path: 'name', location: 'body' }] });
    }

    if (!food) {
      return res.status(400).json({ errors: [{ type: 'field', msg: 'Food is required', path: 'food', location: 'body' }] });
    }

    if (!quantity || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ errors: [{ type: 'field', msg: 'Quantity must be a positive integer', path: 'quantity', location: 'body' }] });
    }

    if (!price || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ errors: [{ type: 'field', msg: 'Price must be a non-negative number', path: 'price', location: 'body' }] });
    }

    const order = await Order.findOneAndUpdate({ _id: id, userId }, { name, food, quantity, price,paymentStatus }, { new: true });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating order' });
  }
});

// Delete Order by ID
app.delete('/orders/:id', validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const order = await Order.findOneAndDelete({ _id: id, userId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting order' });
  }
});
app.get('/orders/:orderId', validateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    const user = await User.findOne({ _id: userId });
    

    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    let msg = `السيد/ة المحترم/ة ${order.name} ❤️ : طلبك هو: ${order.food}  ----  عدد: ${order.quantity} ----- بقيمة: ${order.price} دينار`;
// if(order){


//   try {
//     clientz.messages
//     .create({
//        from: 'whatsapp:+14155238886',
//        body: JSON.stringify(msg),
//        to: 'whatsapp:+962795956190',
//        username: 'mhmd.shrydh1996@gmail.com'
  
//      })
//     .then(message => console.log(message));
//   } catch (error) {
//     console.log(error);
//   }
// }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving order' });
  }
});

// Update Approval Status
app.put('/orders/:orderId/approve', validateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const approved  = true
    paymentStatus ='Paid'
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const userEmail = user.email;
    console.log(userEmail);

    if (userEmail !== 'mhmd.shrydh1996@gmail.com') {
      return res.status(403).json({ message: 'You are not authorized to update the approval status' });
    }

    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.approved = approved;
    order.paymentStatus = paymentStatus || order.paymentStatus;
    await order.save();
    // let msg = `السيد/ه المحترم/ه ${order.name}❤ :  تم دفع قيمة طلبك بنجاح`;


    res.json({ message: 'Approval status updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating approval status' });
  }
});
// Clear All Orders (Accessible only to the email in decodedToken)
app.delete('/orders/clear/all', validateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findOne({ _id: userId });
    if (!user || user.email !== 'mhmd.shrydh1996@gmail.com') {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Order.deleteMany({});

    res.json({ message: 'All orders cleared successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error clearing orders' });
  }
});
app.get('/each/order', validateToken, async (req, res) => {
  console.log(req.body.name);
  try {
    const { name } = req.body;
    const userId = req.userId;
console.log(name);
console.log(userId);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const orders = await Order.find({ name });
    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'No orders found for the user' });
    }

    let totalPrice = 0;
    for (const order of orders) {
      totalPrice += order.price;
    }

    res.json({ name, totalPrice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving total price' });
  }
});
// Start the server
app.listen(3001, () => {
  console.log(`Server is running on http://localhost:3001`);
});
