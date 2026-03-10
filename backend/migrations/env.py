import os
import ssl
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

# import your models
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "layers", "common", "python"))
from common.models import Base

config = context.config
url = os.environ.get("DATABASE_URL")
if url:
    config.set_main_option("sqlalchemy.url", url)

target_metadata = Base.metadata
if config.config_file_name:
    fileConfig(config.config_file_name)

def _make_engine():
    db_url = config.get_main_option("sqlalchemy.url")
    connect_args = {}

    cafile = os.path.join(os.path.dirname(__file__), "rds-combined-ca-bundle.pem")
    if os.path.exists(cafile):
        ctx = ssl.create_default_context(cafile=cafile)
        connect_args["ssl_context"] = ctx

    return create_engine(db_url, poolclass=pool.NullPool, connect_args=connect_args, future=True)


def run_migrations_offline():
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    engine = _make_engine()
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()