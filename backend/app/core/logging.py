import logging
import sys
from contextvars import ContextVar

# Context variable to store the request ID for the current task
request_id_ctx_var: ContextVar[str] = ContextVar("request_id", default="")

class RequestIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id_ctx_var.get()
        return True

def setup_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    
    # Using a format that includes request_id
    formatter = logging.Formatter(
        "%(asctime)s - %(levelname)s - [req:%(request_id)s] - %(name)s - %(message)s"
    )
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(handler)
    
    # Silence some noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

logger = logging.getLogger("app")
