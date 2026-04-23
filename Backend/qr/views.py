from django.shortcuts import render


def index(request):
    """Placeholder view for QR app."""
    return render(request, "qr/index.html")
