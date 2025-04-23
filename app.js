require("dotenv").config();
const express = require("express");
const app = express();
const mustacheExpress = require("mustache-express");
const bodyParser = require("body-parser");
const path = require("path");
const models = require("./models");
const bcrypt = require("bcrypt");
const session = require("express-session");
const fileUpload = require("express-fileupload");
const indexRoutes = require("./routes/index");
const userRoutes = require("./routes/users");
const checkAuthorization = require("./middlewares/authorization");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const VIEWS_PATH = path.join(__dirname, "/views");
const UPLOADS_PATH = path.join(__dirname, "uploads");
const PUBLIC_PATH = path.join(__dirname, "public");

global.__basedir = __dirname;

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOADS_PATH)) {
  fs.mkdirSync(UPLOADS_PATH, { recursive: true });
}

// Create public/images directory if it doesn't exist
if (!fs.existsSync(path.join(PUBLIC_PATH, "images"))) {
  fs.mkdirSync(path.join(PUBLIC_PATH, "images"), { recursive: true });
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "somesecret",
    resave: true,
    saveUninitialized: false,
  })
);

// Add cart count and user details to all views
app.use(async (req, res, next) => {
  if (req.session.user) {
    const cartCount = await models.ShoppingCart.sum("quantity", {
      where: { userId: req.session.user.userId },
    });
    res.locals.cartCount = cartCount || 0;

    // Get user details
    const user = await models.User.findByPk(req.session.user.userId);
    res.locals.user = user ? user.toJSON() : null;
  } else {
    res.locals.cartCount = 0;
    res.locals.user = null;
  }
  next();
});

// Configure file upload middleware
app.use(
  fileUpload({
    createParentPath: true,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
  })
);

// static folders
app.use("/uploads", express.static(UPLOADS_PATH));
app.use("/images", express.static(path.join(PUBLIC_PATH, "images")));
app.use("/css", express.static("css"));

app.use(bodyParser.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.locals.isAuthenticated = false;
  next();
});

// Create the Mustache engine
const mustacheEngine = mustacheExpress(VIEWS_PATH + "/partials", ".mustache");

// Configure the engine with helpers
app.engine("mustache", mustacheEngine);
app.set("views", VIEWS_PATH);
app.set("view engine", "mustache");

// Add helpers to the app locals
app.locals.truncate = function (text) {
  if (text && text.length > 50) {
    return text.substring(0, 50) + "...";
  }
  return text;
};

app.use("/", indexRoutes);
app.use("/users", checkAuthorization, userRoutes);

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const products = await models.Product.findAll({
      include: [
        {
          model: models.ProductImage,
          as: "images",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Pass images array for carousel
    const processedProducts = products.map((product) => {
      const productData = product.get({ plain: true });
      if (productData.images && productData.images.length > 0) {
        productData.images = productData.images.map((img) => ({
          ...img,
          imageURL: img.imageURL,
        }));
      } else {
        productData.images = [];
      }
      return productData;
    });

    res.render("index", {
      products: processedProducts,
      isAuthenticated: req.session.user ? true : false,
    });
  } catch (error) {
    console.error("Error loading products:", error);
    res.render("index", {
      products: [],
      message: "Error loading products. Please try again.",
      type: "danger",
      isAuthenticated: req.session.user ? true : false,
    });
  }
});

router.get("/product-details/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await models.Product.findByPk(productId, {
      include: [
        {
          model: models.User,
          attributes: ["username"],
        },
        {
          model: models.Comment,
          as: "comments",
          include: [
            {
              model: models.User,
              attributes: ["username"],
            },
          ],
        },
        {
          model: models.ProductImage,
          as: "images",
        },
      ],
    });

    if (!product) {
      return res.render("users/product-details", {
        message: "Product not found",
        type: "danger",
        isAuthenticated: true,
      });
    }

    // Ensure images array is present and imageURL is correct
    const productData = product.get({ plain: true });
    if (productData.images && productData.images.length > 0) {
      productData.images = productData.images.map((img) => ({
        ...img,
        imageURL: img.imageURL,
      }));
    } else {
      productData.images = [];
    }

    res.render("users/product-details", {
      product: productData,
      isAuthenticated: true,
    });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.render("users/product-details", {
      message: "Error loading product details",
      type: "danger",
      isAuthenticated: true,
    });
  }
});

app.use("/", router);

app.listen(PORT, () => console.log("Server is running..."));
