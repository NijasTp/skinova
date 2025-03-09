const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const sharp = require("sharp")
const path = require("path")
const fs = require("fs")
const Order = require('../../models/orderSchema')
const Wallet = require('../../models/walletSchema')
const Coupon = require('../../models/couponSchema')
const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true })
    res.render("product-add", {
      cat: category,
    })
  } catch (error) {
    console.error("Error loading product add page:", error)
    res.status(500).json({ success: false, message: "Error loading product add page" })
  }
}

const saveImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    // Generate unique filename
    const filename = Date.now() + '-' + file.originalname.replace(/\s/g, "");
    const filepath = path.join(__dirname, "../../public/uploads/product-images", filename);

    // Resize & convert to WebP
    await sharp(file.buffer)
      .resize(800, 1700, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);

    return res.status(200).json({ success: true, message: "Image saved successfully", filename });
  } catch (error) {
    console.error("Error saving image:", error);
    return res.status(500).json({ success: false, message: "Error saving image" });
  }
};

// add Product with Multiple Image Upload (using Sharp)
const addProducts = async (req, res) => {
  try {
    const { productName, description, category, regularPrice, salePrice, quantity } = req.body;
    const files = req.files;

    if (!files || Object.keys(files).length < 4) {
      return res.status(400).json({ success: false, message: "Please upload at least 4 images" });
    }

    // Run product & category lookup in parallel
    const [productExists, foundCategory] = await Promise.all([
      Product.findOne({ productName }).lean(),
      Category.findOne({ name: category }).lean()
    ]);

    if (productExists) {
      return res.status(400).json({ success: false, message: "Product already exists, try another name" });
    }
    if (!foundCategory) {
      return res.status(400).json({ success: false, message: "Category not found" });
    }

    // Ensure upload directory exists
    const uploadDir = path.join(__dirname, "../../public/uploads/product-images");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Optimize image processing (run in parallel)
    const imageProcessingPromises = Object.values(files).flat().map(async (file) => {
      const filename = Date.now() + '-' + file.originalname.replace(/\s/g, "");
      const filePath = path.join(uploadDir, filename);

      await sharp(file.buffer)
        .resize(800, 1700, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filePath);

      return `uploads/product-images/${filename}`;
    });

    const imageFilenames = await Promise.all(imageProcessingPromises);

    // Create and save new product
    const newProduct = new Product({
      productName,
      description,
      category: foundCategory._id,
      regularPrice,
      salePrice,
      quantity,
      productImage: imageFilenames,
      status: "available",
    });

    await newProduct.save();
    return res.status(200).json({ success: true, message: "Product added successfully" });

  } catch (error) {
    console.error("Error saving product:", error);
    return res.status(500).json({ success: false, message: "Error saving product" });
  }
};


const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = req.query.page || 1;
    const limit = 4;

    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ]
    })
      .sort({ createdAt: -1 }) 
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("category")  // Ensure population of category
      .exec();

    const count = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ]
    }).countDocuments();

    const category = await Category.find({ isListed: true });

    if (category) {
      res.render("products", {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
      });
    } else {
      res.render("admin-error");
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    res.render("admin-error");
  }
};

// const getAllProducts = async (req,res) => {
//   try {
//     res.render("products")
    
//   } catch (error) {
//     res.redirect("/pageerror")
    
//   }
// }



const addProductOffer = async (req, res) => {
  try {
      const { productId, percentage } = req.body;
      const product = await Product.findById(productId);

      if (!product) {
          return res.status(404).json({ status: false, message: "Product not found" });
      }

      product.productOffer = parseInt(percentage);
      product.salePrice = Math.round(product.regularPrice * (1 - percentage / 100));
      await product.save();

      res.json({ status: true, message: "Offer added successfully" });
  } catch (error) {
      console.error("Error in addProductOffer:", error);
      res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
      const { productId } = req.body;
      const product = await Product.findById(productId);

      if (!product) {
          return res.status(404).json({ status: false, message: "Product not found" });
      }

      product.productOffer = 0;
      product.salePrice = product.regularPrice;
      await product.save();

      res.json({ status: true, message: "Offer removed successfully" });
  } catch (error) {
      console.error("Error in removeProductOffer:", error);
      res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const blockProduct = async (req,res) => {
  try {

    let id = req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:true}});
    res.redirect("/admin/products")
    
  } catch (error) {
    res.redirect("/pageerror")
    
  }
}

const unblockProduct = async (req,res) => {
  try {

    let id = req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:false}});
    res.redirect("/admin/products")
    
  } catch (error) {
    res.redirect("/pageerror")
    
  }
}

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id
    const product = await Product.findOne({ _id: id }).populate("category")
    const categories = await Category.find({})

    if (!product) {
      return res.status(404).send("Product not found")
    }

    res.render("product-edit", {
      product: product,
      cat: categories,
    })
  } catch (error) {
    console.error("Error in getEditProduct:", error)
    res.redirect("/pageerror")
  }
}

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const { 
      productName, description, regularPrice, salePrice, 
      quantity, category 
    } = req.body;

    const existingProduct = await Product.findOne({
      productName: productName,
      _id: { $ne: id },
    });

    if (existingProduct) {
      return res.status(400).json({ success: false, message: "Product with this name already exists. Please try another name." });
    }

    const updateFields = {
      productName,
      description,
      regularPrice,
      salePrice,
      quantity,
      category,
    };

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Handle image updates
    for (let i = 1; i <= 4; i++) {
      if (req.files[`image${i}`]) {
        const file = req.files[`image${i}`][0];
        const filename = Date.now() + '-' + file.originalname.replace(/\s/g, "");
        const filepath = path.join(__dirname, "../../public/uploads/product-images", filename);

        await sharp(file.buffer)
          .resize(800, 1700, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(filepath);

        const imagePath = `uploads/product-images/${filename}`;
        
        if (product.productImage[i-1]) {
          product.productImage[i-1] = imagePath;
        } else {
          product.productImage.push(imagePath);
        }
      }
    }

    Object.assign(product, updateFields);
    await product.save();

    // res.json({ success: true, message: "Product updated successfully" });
    res.redirect("/admin/products")

  } catch (error) {
    console.error("Error in editProduct:", error);
    res.status(500).json({ success: false, message: "An error occurred while updating the product" });
  }
};


const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer, imageIndex } = req.body;
    const product = await Product.findById(productIdToServer);

    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    // Remove the image from the array
    product.productImage.splice(imageIndex, 1);
    await product.save();

    const imagePath = path.join(__dirname, "../../public", imageNameToServer);

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log(`Image ${imageNameToServer} deleted successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found`);
    }

    res.json({ status: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error in deleteSingleImage:", error);
    res.status(500).json({ status: false, message: "An error occurred while deleting the image" });
  }
};



const deleteProduct = async (req, res) => {
  const productId = req.query.id;
  
  if (!productId) {
      return res.status(400).json({ status: false, message: 'Product ID is required' });
  }
  
  try {
      // Find and delete the product by its ID
      const product = await Product.findByIdAndDelete(productId);

      if (!product) {
          return res.status(404).json({ status: false, message: 'Product not found' });
      }

      res.redirect('/admin/products'); // Redirect to the products management page or wherever you want
  } catch (err) {
      console.error(err);
      res.status(500).json({ status: false, message: 'Server Error' });
  }
}

const getOrders = async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10; 
      const skip = (page - 1) * limit;

      const totalOrders = await Order.countDocuments();
      const totalPages = Math.ceil(totalOrders / limit);

      const orders = await Order.find()
          .populate({
              path: "userId",
              select: "name phone email",
          })
          .populate({
              path: "product",
              select: "productName productImage salePrice",
          })
          .sort({ createdOn: -1 })
          .skip(skip)
          .limit(limit);

      res.render("admin-orders", {
          orders: orders || [],
          title: "Order Management",
          currentPage: page,
          totalPages: totalPages,
      });
  } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).send("Internal Server Error");
  }
};



const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const orders = await Order.findById(orderId)
      .populate("product", "productName productImage price")
      .populate("userId", "name email")
      .populate("address");

    if (!orders) {
      return res.status(404).send("Order not found");
    }

    res.render("admin-order-details", {
      orders,
      title: "Order Details",
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).send("Internal Server Error");
  }
};


const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Cannot update cancelled order" });
    }



    await Product.findByIdAndUpdate(order.product, { $inc: { quantity: order.quantity } });


    order.status = status;
    if (status === "delivered") {
      order.deliveredOn = new Date();
    }

    await order.save();

    res.json({ success: true, message: "Order status updated successfully" });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};



const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    const order = await Order.findById(orderId).populate({ path: "product", select: "productName quantity" });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status === "delivered") {
      return res.status(400).json({ success: false, message: "Cannot cancel a delivered order" });
    }

    if (order.paymentMethod === "razorpay") {
      let wallet = await Wallet.findOne({ userId: order.userId });

      if (!wallet) {
        wallet = new Wallet({ userId: order.userId, balance: 0, transactions: [] });
      }

      wallet.balance += order.finalPrice;

      const productName = order.product ? order.product.productName : "Unknown Product";

      wallet.transactions.push({
        type: "credit",
        amount: order.finalPrice,
        date: new Date(),
        description: `Refund for cancelling ${productName}`
      });

      await wallet.save();
    }

    if (order.product) {
      await Product.findByIdAndUpdate(order.product._id, { $inc: { quantity: order.quantity } });
    }

    order.status = "cancelled";
    await order.save();

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};



const approveReturn = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId).populate('product', 'productName');

    if (!order || order.status !== "return request") {
      return res.status(404).json({ success: false, message: "Invalid return request" });
    }

    order.status = "returned";
    await order.save();

    if (order.paymentMethod !== "cod") {
      let wallet = await Wallet.findOne({ userId: order.userId });

      if (!wallet) {
        wallet = new Wallet({ userId: order.userId, balance: 0, transactions: [] });
      }

      const refundAmount = order.finalPrice;

      wallet.balance += refundAmount;
      wallet.transactions.push({
        type: "credit",
        amount: refundAmount,
        description: `Refund for Returning ${order.product.productName}`,
        timestamp: new Date(),
      });

      await wallet.save();
    }

    res.json({ success: true, message: "Return approved and refund processed successfully" });
  } catch (error) {
    console.error("Error approving return:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const rejectReturn = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order || order.status !== "return request") {
      return res.status(404).json({ success: false, message: "Invalid return request" });
    }

    order.status = "return rejected";
    await order.save();

    res.json({ success: true, message: "Return request rejected" });
  } catch (error) {
    console.error("Error rejecting return:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const getCoupons = async (req, res) => {
  try {
      const coupons = await Coupon.find();
      res.render('admin-coupons', { coupons });
  } catch (error) {
      console.error("Error fetching coupons:", error);
      res.status(500).send("Internal server error");
  }
}

const getCouponAddPage = (req, res) => {
  res.render('add-coupon');
}

const addCoupon = async (req, res) => {
  try {
      const { code, name, offerPrice, minimumPrice, expireOn, usageLimit } = req.body;

      // Validate required fields
      if (!code || !name || !offerPrice || !minimumPrice || !expireOn || !usageLimit) {
          return res.json( {success: false, message: "All fields are required."} );
      }

      // Check if the coupon already exists
      const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
      if (existingCoupon) {
          return res.json( {success: false, message: "Coupon code already exists."});
      }

      // Create and save new coupon
      const newCoupon = new Coupon({
          code: code.toUpperCase(),
          name,
          offerPrice,
          minimumPrice,
          expireOn,
          usageLimit,
          isActive: true
      });

      await newCoupon.save();
      res.redirect("/admin/coupon");
  } catch (error) {
      console.error("Error adding coupon:", error);
      res.status(500).send("Internal server error.");
  }
}

const deleteCoupon = async (req, res) => {
  try {
      const couponId = req.params.id;

      if (!couponId.match(/^[0-9a-fA-F]{24}$/)) {
          return res.status(400).json({ success: false, message: "Invalid Coupon ID" });
      }

      const deletedCoupon = await Coupon.findByIdAndDelete(couponId);

      if (!deletedCoupon) {
          return res.status(404).json({ success: false, message: "Coupon not found" });
      }

      req.flash("success", "Coupon deleted successfully!");
      res.redirect("/admin/coupon"); 

  } catch (error) {
      console.error("❌ Error deleting coupon:", error);
      req.flash("error", "Something went wrong while deleting the coupon.");
      res.redirect("/admin/coupon");
  }
}

module.exports = {
  getProductAddPage,
  saveImage,
  addProducts,
  getAllProducts,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
  deleteProduct,
  getOrders,
  getOrderDetails,
  updateOrderStatus,
  cancelOrder,
  approveReturn,
  rejectReturn,
  getCoupons,
  getCouponAddPage,
  addCoupon,
  deleteCoupon


}
