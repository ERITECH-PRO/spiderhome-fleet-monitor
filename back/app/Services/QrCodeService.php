<?php

namespace App\Services;

use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;
use chillerlan\QRCode\Output\QROutputInterface;

/**
 * Génération de QR code pour la fiche module — cahier des charges §7/§8
 * (onboarding et identification terrain par un technicien).
 *
 * Basée sur chillerlan/php-qrcode (^5.0, ajouté au premier build Docker —
 * voir back/Dockerfile). ⚠️ Fonctionnalité ajoutée sans pouvoir exécuter de
 * test dans cet environnement : à vérifier une fois déployé en appelant
 * GET /api/devices/{id}/qr et en scannant le SVG obtenu.
 */
class QrCodeService
{
    public static function generateSvg(string $content, int $size = 300): string
    {
        $qrcode = new QRCode(new QROptions([
            'outputType'  => QROutputInterface::MARKUP_SVG,
            'eccLevel'    => QRCode::ECC_L,
            'svgWidth'    => $size,
            'svgHeight'   => $size,
            'imageBase64' => false,
            'addQuietzone' => true,
        ]));

        return $qrcode->render($content);
    }

    public static function generateDataUrl(string $content, int $size = 300): string
    {
        $qrcode = new QRCode(new QROptions([
            'outputType'  => QROutputInterface::MARKUP_SVG,
            'eccLevel'    => QRCode::ECC_L,
            'svgWidth'    => $size,
            'svgHeight'   => $size,
            'imageBase64' => true,
            'addQuietzone' => true,
        ]));

        return $qrcode->render($content);
    }
}
