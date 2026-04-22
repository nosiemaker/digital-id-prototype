from typing import Optional
from citizens.models import Citizen, FamilyLink, RelationshipType
from citizens.schema import FamilyLinkBase, FamilyLinkResponse, CitizenSummary
import logging
from Utils.audit_logger import audit

logger = logging.getLogger(__name__)


def create_family_link(
    citizen_din: str, family_link_data: FamilyLinkBase, actor_id: Optional[int] = None, actor_role: str = "SYSTEM"
) -> Optional[FamilyLinkResponse]:
    """
    Create a family link for a citizen.
    """
    # Get the citizen
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        return None

    # Get the related citizen by DIN
    try:
        related_citizen = Citizen.objects.get(din=family_link_data.related_citizen_din)
    except Citizen.DoesNotExist:
        return None

    # Check if family link already exists
    try:
        existing_link = FamilyLink.objects.get(
            citizen=citizen,
            related_citizen=related_citizen,
            relationship_type=family_link_data.relationship_type,
        )
        # Link already exists, return it
        return _create_family_link_response(existing_link)
    except FamilyLink.DoesNotExist:
        pass  # No existing link, continue to create new one

    # Create new family link
    family_link = FamilyLink(
        citizen=citizen,
        related_citizen=related_citizen,
        relationship_type=family_link_data.relationship_type,
    )

    family_link.save()
    
    # Log the family link creation if actor info is provided
    if actor_id:
        audit.family_link_created(actor_id, citizen_din, family_link_data.related_citizen_din, family_link_data.relationship_type)

    logger.info(f"Created family link between {citizen.din} and {related_citizen.din}")
    return _create_family_link_response(family_link)


def get_family_links(citizen_din: str) -> list[FamilyLinkResponse]:
    """
    Get all family links for a citizen.
    """
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        return []

    # Get links where this citizen is the source
    links = FamilyLink.objects.filter(citizen=citizen)

    # Convert to response objects
    return [_create_family_link_response(link) for link in links]


def get_family_tree(citizen_din: str) -> dict:
    """
    Get family tree for a citizen.
    """
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        return {}

    # Get all family links for this citizen
    links = FamilyLink.objects.filter(citizen=citizen)

    # Initialize family tree structure
    family_tree = {
        "citizen": CitizenSummary.from_orm(citizen),
        "parents": [],
        "children": [],
        "siblings": [],
        "spouses": [],
    }

    # Process each link
    for link in links:
        related_citizen_summary = CitizenSummary.from_orm(link.related_citizen)

        if link.relationship_type == RelationshipType.PARENT:
            family_tree["parents"].append(related_citizen_summary)
        elif link.relationship_type == RelationshipType.CHILD:
            family_tree["children"].append(related_citizen_summary)
        elif link.relationship_type == RelationshipType.SIBLING:
            family_tree["siblings"].append(related_citizen_summary)
        elif link.relationship_type == RelationshipType.SPOUSE:
            family_tree["spouses"].append(related_citizen_summary)
        # Guardianship links are not included in the basic family tree view

    return family_tree


def delete_family_link(
    db,
    citizen_din: str,
    related_citizen_din: str,
    relationship_type: RelationshipType,
) -> bool:
    """
    Delete a family link.
    """
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        return False

    try:
        related_citizen = Citizen.objects.get(din=related_citizen_din)
    except Citizen.DoesNotExist:
        return False

    # Find and delete the link
    try:
        link = FamilyLink.objects.get(
            citizen=citizen,
            related_citizen=related_citizen,
            relationship_type=relationship_type,
        )
        link.delete()
        return True
    except FamilyLink.DoesNotExist:
        return False


def _create_family_link_response(link: FamilyLink) -> FamilyLinkResponse:
    """
    Helper function to create a FamilyLinkResponse from a FamilyLink model.
    """
    return FamilyLinkResponse(
        id=link.id,
        citizen=CitizenSummary.from_orm(link.citizen),
        related_citizen=CitizenSummary.from_orm(link.related_citizen),
        relationship_type=link.relationship_type,
        created_at=link.created_at,
    )
