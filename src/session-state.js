// Older saved connections may still contain expiresAt. It no longer limits access.
export const connectionAvailable = (connection) =>
  Boolean(connection?.token) && !connection.needsCode;
