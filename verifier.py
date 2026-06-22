# pyright: reportUnnecessaryIsInstance = false

import json
from typing import Optional, TypedDict


ALLOWED_TONES = {'romance', 'legal', 'family', 'custom'}
ALLOWED_WARNINGS = {
    "Not an official member of the family.",
    "Not acknowledged by rayen.",
    "Acknowledged by rayen but doesn't have the discord role."
}


class Person(TypedDict):
    id: str
    name: str
    role: Optional[str]
    location: Optional[str]
    born: Optional[str]
    died: Optional[str]
    aliases: Optional[list[str]]
    avatarImage: Optional[str]
    generation: int
    order: int
    bio: Optional[str]
    socialLinks: Optional[dict[str, str]]
    warnings: Optional[list[str]]


Relationship = TypedDict('Relationship', {
    'from': str,
    'to': str,
    'label': str,
    'tone': str,
    'reverseLabel': Optional[str]
})


class Data(TypedDict):
    people: list[Person]
    relations: list[Relationship]


def verify_family_tree(file_path: str):
    with open(file_path, 'r') as f:
        data: Data = json.load(f)

    if 'people' not in data:
        print("Invalid data format: missing 'people' key.")
        return False
    if not isinstance(data['people'], list):
        print("Invalid data format: 'people' should be a list.")
        return False

    if 'relations' not in data:
        print("Invalid data format: missing 'relations' key.")
        return False
    if not isinstance(data['relations'], list):
        print("Invalid data format: 'relations' should be a list.")
        return False

    # Verify that each member has a unique ID
    member_ids: set[str] = set()
    member_pos: set[tuple[int, int]] = set()
    for member in data['people']:
        if not isinstance(member, dict):
            print("Invalid member data: each member should be a dictionary.")
            return False
        if 'id' not in member:
            print("Invalid member data: missing 'id' key.")
            return False
        if member['id'] in member_ids:
            print(f"Duplicate ID found: {member['id']}")
            return False
        if 'name' not in member:
            print(f"Invalid member data: missing 'name' key for member with ID {member['id']}.")
            return False
        if 'generation' not in member:
            print(f"Invalid member data: missing 'generation' key for member with ID {member['id']}.")
            return False
        if 'order' not in member:
            print(f"Invalid member data: missing 'order' key for member with ID {member['id']}.")
            return False
        if not isinstance(member['generation'], int) or member['generation'] < 0:
            print(f"Invalid generation value for member with ID {member['id']}: {member['generation']}")
            return False
        if not isinstance(member['order'], int) or member['order'] < 0:
            print(f"Invalid order value for member with ID {member['id']}: {member['order']}")
            return False
        if 'warnings' in member:
            if not isinstance(member['warnings'], list):
                print(f"Invalid warnings format for member with ID {member['id']}: should be a list.")
                return False
            for warning in member['warnings']:
                if warning not in ALLOWED_WARNINGS:
                    print(f"Invalid warning for member with ID {member['id']}: {warning}")
                    return False
        if (member['generation'], member['order']) in member_pos:
            print(f"Duplicate position found: generation {member['generation']}, order {member['order']}")
            return False
        member_ids.add(member['id'])
        member_pos.add((member['generation'], member['order']))

    poses: dict[int, set[int]] = {}
    for pos in member_pos:
        gen, ord = pos
        if gen not in poses:
            poses[gen] = set()
        poses[gen].add(ord)

    for gen, ords in poses.items():
        if list(sorted(ords)) != list(range(len(ords))):
            print(f"Generation {gen} has non-contiguous order values: {sorted(ords)}")
            return False

    # Verify that each relationship references valid member IDs
    for relationship in data['relations']:
        if not isinstance(relationship, dict):
            print("Invalid relationship data: each relationship should be a dictionary.")
            return False
        if 'from' not in relationship:
            print("Invalid relationship data: missing 'from' key.")
            return False
        if 'to' not in relationship:
            print("Invalid relationship data: missing 'to' key.")
            return False
        if 'label' not in relationship:
            print("Invalid relationship data: missing 'label' key.")
            return False
        if 'tone' not in relationship:
            print("Invalid relationship data: missing 'tone' key.")
            return False
        if relationship['tone'] not in ALLOWED_TONES:
            print(f"Invalid relationship tone: {relationship['tone']}")
            return False
        if relationship['from'] not in member_ids:
            print(f"Invalid 'from' ID in relationship: {relationship['from']}")
            return False
        if relationship['to'] not in member_ids:
            print(f"Invalid 'to' ID in relationship: {relationship['to']}")
            return False
        if 'reverseLabel' in relationship and not relationship['reverseLabel']:
            print("Invalid relationship data: 'reverseLabel' cannot be empty if it exists.")
            return False
        if relationship['from'] == relationship['to']:
            print(f"Invalid relationship: 'from' and 'to' cannot be the same (ID: {relationship['from']}).")
            return False

    print("Family tree verification passed.")
    return True


if __name__ == "__main__":
    if verify_family_tree('src/family-tree.json'):
        exit(0)
    exit(1)
