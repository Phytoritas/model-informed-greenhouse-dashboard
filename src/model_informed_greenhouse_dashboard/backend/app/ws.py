"""WebSocket broadcaster for real-time updates."""
import logging
import json
from typing import Set, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and broadcasting."""
    
    def __init__(self):
        """Initialize connection manager."""
        self.active_connections: Dict[str, Set[WebSocket]] = {
            '/ws/sim': set(),
            '/ws/forecast': set(),
        }
        logger.info("ConnectionManager initialized")
    
    async def connect(self, websocket: WebSocket, path: str):
        """Accept and register a new WebSocket connection.
        
        Args:
            websocket: WebSocket instance
            path: WebSocket path ('/ws/sim' or '/ws/forecast')
        """
        await websocket.accept()
        if path not in self.active_connections:
            self.active_connections[path] = set()
        self.active_connections[path].add(websocket)
        logger.info(f"Client connected to {path} (total: {len(self.active_connections[path])})")
    
    def disconnect(self, websocket: WebSocket, path: str):
        """Remove a WebSocket connection.
        
        Args:
            websocket: WebSocket instance
            path: WebSocket path
        """
        if path in self.active_connections:
            self.active_connections[path].discard(websocket)
            logger.info(f"Client disconnected from {path} (remaining: {len(self.active_connections[path])})")
    
    async def broadcast(self, path: str, message: Dict[str, Any]):
        """Broadcast a message to all clients on a path.
        
        Args:
            path: WebSocket path
            message: Message dict to broadcast (will be JSON-serialized)
        """
        if path not in self.active_connections:
            return
        
        # Serialize message
        try:
            data = json.dumps(message, default=str)
        except Exception as e:
            logger.error(f"Failed to serialize message: {e}")
            return
        
        # Broadcast to all connections
        dead_connections = set()
        for websocket in self.active_connections[path]:
            try:
                await websocket.send_text(data)
            except Exception as e:
                logger.warning(f"Failed to send to client: {e}")
                dead_connections.add(websocket)
        
        # Clean up dead connections
        for ws in dead_connections:
            self.active_connections[path].discard(ws)
    
    def broadcast_sync(self, path: str, message: Dict[str, Any]):
        """Synchronous broadcast wrapper (for use in non-async contexts).
        
        Note: This method is best-effort and may not work from background threads.
        For reliable broadcasting, use the async broadcast() method directly.
        
        Args:
            path: WebSocket path
            message: Message dict
        """
        import asyncio
        try:
            # Try to get the running event loop
            try:
                loop = asyncio.get_running_loop()
                # Schedule from another thread using run_coroutine_threadsafe
                asyncio.run_coroutine_threadsafe(self.broadcast(path, message), loop)
                # Don't wait for completion to avoid blocking
            except RuntimeError:
                # No event loop in current thread - silently skip
                # This is expected when called from ProcessPoolExecutor callbacks
                logger.debug(f"Skipping broadcast from non-async context: {path}")
        except Exception as e:
            logger.warning(f"Synchronous broadcast skipped: {e}")


# Global instance
manager = ConnectionManager()

