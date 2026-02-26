/* eslint-disable no-console */
import 'dotenv/config'
import express from 'express'
import http from 'http';
import swaggerUi from 'swagger-ui-express'
import { ApolloServer } from 'apollo-server-express';
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core';
import { print } from 'graphql'
import { loadSchemaSync } from '@graphql-tools/load'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge'
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import { openapiSpecification } from './swaggerDocOptions'
import path from 'path';
import { mainRouter } from './routes'
import cors from 'cors';

const app = express()
const port = process.env.PORT || 3000
const hostUrl = process.env.HOST_URL || `http://localhost:${port}`

// Production Hardening: Environment Validation
if (process.env.NODE_ENV === 'production') {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('WARNING: OPENAI_API_KEY is not set. MCP features will not be available.');
  }
  if (!process.env.HOST_URL) {
    console.warn(`WARNING: HOST_URL is not set. Defaulting to ${hostUrl}. Ensure this matches your public domain.`);
  }
}

// CORS Configuration from environment variables
// CORS_ORIGINS: Comma-separated list of allowed origins
// CORS_METHODS: Comma-separated list of allowed HTTP methods  
// CORS_HEADERS: Comma-separated list of allowed headers
// CORS_CREDENTIALS: Enable/disable credentials (default: true)

// Enable CORS for all routes
const corsOrigins = process.env.CORS_ORIGINS ?
  process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()) :
  [];

const corsMethods = process.env.CORS_METHODS ?
  process.env.CORS_METHODS.split(',').map(method => method.trim()) :
  ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];

const corsHeaders = process.env.CORS_HEADERS ?
  process.env.CORS_HEADERS.split(',').map(header => header.trim()) :
  ['Content-Type', 'Authorization'];

app.use(cors({
  origin: [
    ...corsOrigins,
    /^http:\/\/localhost:\d+$/,  // Allow any localhost port
    /^http:\/\/127\.0\.0\.1:\d+$/ // Allow any 127.0.0.1 port
  ],
  methods: corsMethods,
  allowedHeaders: corsHeaders,
  credentials: process.env.CORS_CREDENTIALS !== 'false'
}));

// Add JSON body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(mainRouter)
app.get('/api-docs', (req, res) => {
  const host = req.get('host');
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const currentHostUrl = process.env.HOST_URL || `${protocol}://${host}`;

  const dynamicSpec = JSON.parse(JSON.stringify(openapiSpecification));
  dynamicSpec.servers = [{ url: currentHostUrl }];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NSE India API Docs</title>
  <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/favicon-32x32.png" sizes="32x32" />
  <link rel="icon" type="image/png" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/favicon-16x16.png" sizes="16x16" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-bundle.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        spec: ${JSON.stringify(dynamicSpec)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandalonePreset"
      });
      window.ui = ui;
    };
  </script>
</body>
</html>`;
  res.send(html);
});
// No longer need swaggerUi.serve as we are using a self-contained HTML

const loadedTypeDefs = loadSchemaSync(path.join(__dirname, './**/*.graphql'), { loaders: [new GraphQLFileLoader()] })
const loadedResolvers = loadFilesSync(path.join(__dirname, './**/*.resolver.{ts,js}'))

const typeDefs = mergeTypeDefs(loadedTypeDefs)

if (process.env.NODE_ENV === 'development') {
  console.log('\n=== GraphQL Schema Start ===\n')
  const printedTypeDefs = print(typeDefs)
  console.log(printedTypeDefs)
  console.log('\n=== GraphQL Schema End ===\n')

}

const resolvers = mergeResolvers(loadedResolvers)

const httpServer = http.createServer(app);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })]
});


// Apollo Server 3 requires async start
let isApolloStarted = false;
const startApollo = async () => {
  if (!isApolloStarted) {
    await server.start();
    server.applyMiddleware({ app });
    isApolloStarted = true;
  }
};

// Middleware to ensure Apollo is started before handling any request (for Serverless)
app.use(async (req, res, next) => {
  if (req.path === server.graphqlPath) {
    await startApollo();
  }
  next();
});

// For traditional servers (Hostinger, Local)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  startApollo().then(() => {
    app.listen(port, () => {
      console.log(`NseIndia App started in port ${port}`);
      console.log(`For API docs: ${hostUrl}/api-docs`);
      console.log(`Open ${hostUrl} in browser.`);
      console.log(`For graphql: ${hostUrl}${server.graphqlPath}`);

      // Log CORS configuration
      if (corsOrigins.length > 0) {
        console.log(`CORS Origins: ${corsOrigins.join(', ')}`);
      }
      console.log(`CORS Methods: ${corsMethods.join(', ')}`);
      console.log(`CORS Headers: ${corsHeaders.join(', ')}`);
      console.log(`CORS Credentials: ${process.env.CORS_CREDENTIALS !== 'false'}`);
    });
  }).catch(err => {
    console.error('Failed to start Apollo Server:', err);
  });
}

export default app;
