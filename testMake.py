from time import sleep
from random import random
from math import floor
import os

startID = 0

names = ["Alice", "Bob", "Jonathan", "Julian", "John", "Mark", "Trump", "Abdullah", "Eisha", "Amir", "Derek", "Josh", "Conner", "Margeret", "Linda", "Jess"]

for i in range(50):
    amount = round(random() * 200000)
    idS = startID + i
    name = names[floor(random() * len(names))]

    os.system('curl -X POST http://localhost:8080/api/data/add \
                    -H "Content-Type: application/json" \
                    -d \'{ "dbname": "mydb", "tableName": "salary", "data": { "id": ' + str(idS) + ', "salary": ' + str(amount) + ' } }\'')

    os.system('curl -X POST http://localhost:8080/api/data/add \
                    -H "Content-Type: application/json" \
                    -d \'{ "dbname": "mydb", "tableName": "names", "data": { "id": ' + str(idS) + ', "name": "' + name + '" } }\'')
    
    print()

