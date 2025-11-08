import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "906280d550d4"
down_revision = "05912c95236d"
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "listings" not in insp.get_table_names():
        op.create_table(
            "listings",
            sa.Column("id", sa.BigInteger, primary_key=True),
            sa.Column("title", sa.Text, nullable=False),
            sa.Column("street", sa.Text, nullable=True),
            sa.Column("city", sa.Text, nullable=True),
            sa.Column("price", sa.Integer, nullable=False),
            sa.Column("rating", sa.Float, nullable=False, server_default="0"),
            sa.Column("amenities", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
            sa.Column("photo_url", sa.Text, nullable=True),
            sa.Column("latitude", sa.Float, nullable=False),
            sa.Column("longitude", sa.Float, nullable=False),
            sa.Column("images", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
            sa.Column("thumbnails", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
    else:
        # Ensure any missing columns are added (safe to run multiple times)
        existing = {c["name"] for c in insp.get_columns("listings")}
        def add(name, col):
            if name not in existing:
                op.add_column("listings", col)

        add("street",      sa.Column("street", sa.Text))
        add("city",        sa.Column("city", sa.Text))
        add("price",       sa.Column("price", sa.Integer, nullable=False, server_default="0"))
        add("rating",      sa.Column("rating", sa.Float, nullable=False, server_default="0"))
        add("amenities",   sa.Column("amenities", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"))
        add("photo_url",   sa.Column("photo_url", sa.Text))
        add("latitude",    sa.Column("latitude", sa.Float, nullable=False, server_default="0"))
        add("longitude",   sa.Column("longitude", sa.Float, nullable=False, server_default="0"))
        add("images",      sa.Column("images", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"))
        add("thumbnails",  sa.Column("thumbnails", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"))
        add("description", sa.Column("description", sa.Text))
        add("created_at",  sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
        add("updated_at",  sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))

        # (optional) drop server defaults you only wanted during backfill
        with op.batch_alter_table("listings") as b:
            for col in ["price","rating","latitude","longitude","images","thumbnails","created_at","updated_at","amenities"]:
                try:
                    b.alter_column(col, server_default=None)
                except Exception:
                    pass  # ignore if DB disallows or default already unset

def downgrade():
    op.drop_table("listings")
