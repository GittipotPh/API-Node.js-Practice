import express from "express";
import { MongoClient} from "mongodb";
import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import jwt from "jsonwebtoken";

require('dotenv').config();

const app = express();
const port = 3000;
const dbName = "gittipot-local";
const usersCollectionName = "allusers";
const messagesCollectionName = "allmessages";
const mongoURI = process.env.MONGO_URI;
const usersecretKey = process.env.SECRET_KEY;
const systemSecretKey = process.env.SYSTEM_SECRET_KEY;;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let allusers;
let allmessages; 

// login controller for chatting method on customer and system
const authenticate = async (req, res, next, secretKey) => {
  const token = req.headers.authorization;
  
  if (!token) { 
    req.userNoStatus = false;
    req.systemNoStatus = false;
    return res.status(401).json({ success: false, message: "Unauthorized access" });
   
  }
  
  try {
    const decoded = jwt.verify(token, secretKey);

    if (secretKey === usersecretKey) {
      const UserIdPassed = await allusers.findOne({ _id: decoded.customerId });
      userNoStatus = true; 
      req.customerId = UserIdPassed; }

    if (secretKey === systemSecretKey) {
      const SystemIdPassed = await allusers.findOne({ _id: decoded.customerId });
      systemNoStatus = true; 
      req.customerId = SystemIdPassed; } 

    next(); 

  } catch (err) {
    return res.status(401).json({ success: false, message: "Unauthorized access" });}};
  


app.use(async (req, res, next) => {
  await authenticate(req, res, next, "your-secret-key");
});

app.use(async (req, res, next) => {
  await authenticate(req, res, next, "your-system-secret-key");
});
  
// Creat 6-digit ID for alluser and system
function generateCustomerId() {
    
    let customerId = "";
  
    do {
        customerId = ""; 

    for (let i = 0; i < 6; i++) {
      const digit = Math.floor(Math.random() * 10);
      customerId += digit;
    }} 
    
    while (!checkIdUsed(customerId) && customerId.length === 6); ;
  
    return customerId;
  }

// check if the id is used or not
async function checkIdUsed(customerId) {
    const { allusers } = await connect();
    const UserExistId = await allusers.findOne({customerId});
    return !UserExistId ;
}
  
//connect to mongoDB main database

async function connect() {
  const client = new MongoClient(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  return {
    allusers: client.db(dbName).collection(usersCollectionName),
    allmessages: client.db(dbName).collection(messagesCollectionName),
  };
}

// Register
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const { allusers } = await connect();
    const existingUser = await allusers.findOne({ username });

    if (existingUser) {
    res.status(409).json({ success: false,
      error:"UsernameAlreadyExists" , 
      message:"Username already in use please choose a different username."}, );}
    
    // generate new 6-digit customerId
    const customerId = generateCustomerId();

    //hash password for more secure
    const hashedPassword = await bcrypt.hash(password, 10);
    
    
    
    await allusers.insertOne({ username, password: hashedPassword, _id: customerId });

    res.status(201).json({ success: true, message: "User registered successfully" });
  } catch (error) {
    console.error("Error:", error); res.status(500).json({ error: "Internal Server Error" });}});


//login method

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const { allusers } = await connect();
    const userData = await allusers.findOne({ username });


    if (userData && await bcrypt.compare(password, userData.password)) {

      res.status(200).json({ success: true, message: "Login successful"});} 
      
    else {res.status(401).json({ success: false, message: "Invalid credentials" });}

  } catch (error) {console.error("Error:", error); res.status(500).json({ error: "Internal Server Error" });}});



// customer Chat with System using their customerId
app.post("/customer/chat",authenticate, async (req, res) => {
  try {

    const { sender , content} = req.body;  

    if (req.customerDataId && userNoStatus) {
      const { allmessages } = await connect();
      const message = { sender, content, timestamp: new Date(), customerId: req.customerDataId._id };
      await allmessages.insertOne(message);
      res.status(201).json(message); }

    else {return res.status(403).json({ success: false, message: "Invalid customer ID or You still didn't Login to the Sysytem" });}
  
  } catch (error) {console.error("Error:", error);res.status(500).json({ error: "Internal Server Error" });}});


// System Chat to customer using customerId
app.post("/system/chat/:customerId",authenticate, async (req, res) => {

  try {   
    // must authenticate

    if (req.customerDataId && systemNoStatus) {
      
      const { sender , content} = req.body; 
      const { allmessages } = await connect();
      const message = { sender, content, timestamp: new Date(), customerId: req.customerDataId._id };
      await allmessages.insertOne(message);
      res.status(201).json(message); }

    else {return res.status(403).json({ success: false, message: "Forbidden: Access restricted" });}
  
  } catch (error) {console.error("Error:", error);res.status(500).json({ error: "Internal Server Error" });}});


// Chat history requires customerId
app.get("/chat/history/:customerId",authenticate ,async (req, res) => {
    try {
      // must authenticate

    if (req.customerDataId && systemNoStatus) {  
    const { customerId } = req.params;
    const { allmessages } = await connect();

    const history = await allmessages.find({customerId: ObjectId(customerId)}).toArray();
    res.json(history);}

   else {

    res.status(403).json({ success: false, message: "Forbidden: Access restricted" });
  }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// Delete data need customerID 
app.delete("/chat/delete/:customerId",authenticate, async (req, res) => {
    try {
      // must authenticate

    if (req.customerDataId && systemNoStatus) {
      const { customerId } = req.params;
      const { allusers } = await connect();
      const customer = await allusers.findOne({ _id: ObjectId(customerId) });
  
      if (!customer) {
        return res.status(401).json({ success: false, message: "Invalid customer ID" });
      }
  
      const { allmessages } = await connect();
      await allmessages.deleteMany({ customerId: ObjectId(customerId) });
  
      res.json({ success: true, message: "allmessages deleted successfully" });}

    else {

      res.status(403).json({ success: false, message: "Forbidden: Access restricted" });
    }
      
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
  