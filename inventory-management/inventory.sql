-- Create Database
CREATE DATABASE IF NOT EXISTS `inventory_db`;
USE `inventory_db`;

-- Admin Table
CREATE TABLE IF NOT EXISTS `admin` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL
);

-- Category Table
CREATE TABLE IF NOT EXISTS `category` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) UNIQUE NOT NULL
);

-- Supplier Table
CREATE TABLE IF NOT EXISTS `supplier` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `company` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `address` TEXT NOT NULL
);

-- Product Table
CREATE TABLE IF NOT EXISTS `product` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `supplier` VARCHAR(100) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `quantity` INT NOT NULL,
  `minimum` INT NOT NULL,
  `maximum` INT NOT NULL,
  `avg_daily_sales` DECIMAL(10,2) NOT NULL
);

-- Insert Admin credentials
INSERT INTO `admin` (`username`, `password`) 
VALUES ('admin', 'admin123') 
ON DUPLICATE KEY UPDATE `username`=`username`;

-- Insert default categories
INSERT INTO `category` (`name`) 
VALUES ('Dairy'), ('Grains'), ('Beverages'), ('Snacks')
ON DUPLICATE KEY UPDATE `name`=`name`;

-- Insert default suppliers
INSERT INTO `supplier` (`name`, `company`, `phone`, `email`, `address`) VALUES 
('John Doe', 'Dairy Fresh Corp', '9876543210', 'john@dairyfresh.com', '123 Milk Way, Dairy City'),
('Jane Smith', 'Golden Grains Co', '9876543211', 'jane@goldengrains.com', '456 Wheat Fields, Grain Valley'),
('Bob Johnson', 'Beverage King', '9876543212', 'bob@bevking.com', '789 Soda Springs, Drink Town');

-- Insert default products with diverse restocking statuses
INSERT INTO `product` (`name`, `category`, `supplier`, `price`, `quantity`, `minimum`, `maximum`, `avg_daily_sales`) VALUES 
('Fresh Milk 1L', 'Dairy', 'John Doe', 60.00, 50, 20, 100, 5.00),
('Organic Butter 500g', 'Dairy', 'John Doe', 250.00, 12, 15, 50, 3.00),
('White Rice 5kg', 'Grains', 'Jane Smith', 350.00, 0, 10, 80, 2.50),
('Cola 500ml', 'Beverages', 'Bob Johnson', 40.00, 100, 30, 200, 12.00),
('Potato Chips 100g', 'Snacks', 'Jane Smith', 20.00, 150, 25, 250, 6.00),
('Apple Juice 1L', 'Beverages', 'Bob Johnson', 110.00, 5, 10, 40, 2.00);
