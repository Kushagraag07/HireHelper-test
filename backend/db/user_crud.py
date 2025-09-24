from db.database import users_collection

def get_user_by_email(email: str):
    return users_collection.find_one({"email": email})

def create_user(user_data: dict):
    result = users_collection.insert_one(user_data)
    return result.inserted_id

def delete_refresh_token(token: str):
    from db.database import tokens_collection
    tokens_collection.delete_one({"token": token})

