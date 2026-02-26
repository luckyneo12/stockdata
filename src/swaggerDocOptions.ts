import swaggerJsDoc from 'swagger-jsdoc'
import path from 'path'

export const swaggerDocOptions = {
    definition: {
        "openapi": "3.0.0",
        "info": {
            "version": "1.1.0",
            "title": "National Stock Exchange - India (Unofficial)",
            "description": "This package will help us to get equity details and historical data" +
                " from National Stock Exchange of India.",
            "contact": {
                "email": "asraf.cse@gmail.com"
            },
            "license": {
                "name": "MIT",
                "url": "https://github.com/hi-imcodeman/stock-nse-india/blob/master/LICENSE"
            }
        },
        "servers": [
            {
                "url": "/"
            }
        ],
        "tags": [
            {
                "name": "Base",
                "description": "Base API of NSE India"
            },
            {
                "name": "Common",
                "description": "Contains all common APIs of NSE India"
            },
            {
                "name": "Equity",
                "description": "Contains all equity related APIs of NSE India"
            },
            {
                "name": "Index",
                "description": "Contains all index related APIs of NSE India"
            },
            {
                "name": "Commodity",
                "description": "Contains all commodity related APIs of NSE India"
            },
            {
                "name": "Helpers",
                "description": "Contains all helper APIs of NSE India"
            },
        ]
    },
    // Dynamically point to routes based on environment
    apis: [
        path.join(__dirname, './routes.{ts,js}'),
        path.join(__dirname, './server.{ts,js}')
    ]
}

export const openapiSpecification = swaggerJsDoc(swaggerDocOptions);
