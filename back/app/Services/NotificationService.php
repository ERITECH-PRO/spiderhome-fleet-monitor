<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\ServiceRequest;
use App\Models\User;

/**
 * Notifications in-app — cahier §7.4 : « Une notification est envoyée à
 * chaque changement significatif [d'une demande d'intervention]. »
 */
class NotificationService
{
    /**
     * Notifie le client (tous ses comptes de rôle « client ») et le
     * technicien assigné d'un changement sur une demande SAV.
     */
    public static function serviceRequestChanged(ServiceRequest $sr, string $title, ?string $message = null): void
    {
        $recipients = User::where('role', User::ROLE_CLIENT)
            ->where('customer_id', $sr->customer_id)
            ->pluck('id');

        if ($sr->assigned_to) {
            $recipients->push($sr->assigned_to);
        }

        static::notifyMany($recipients->unique()->all(), 'service_request', $title, $message, "/interventions?id={$sr->id}");
    }

    /**
     * Notifie l'équipe support/admin d'une nouvelle demande entrante.
     */
    public static function serviceRequestCreated(ServiceRequest $sr): void
    {
        $staff = User::whereIn('role', [User::ROLE_ADMIN, User::ROLE_SUPPORT])->pluck('id')->all();

        static::notifyMany(
            $staff,
            'service_request',
            'Nouvelle demande SAV : ' . $sr->reference,
            $sr->title,
            "/interventions?id={$sr->id}"
        );
    }

    private static function notifyMany(array $userIds, string $type, string $title, ?string $message, ?string $link): void
    {
        $now = now();

        $rows = array_map(fn ($id) => [
            'user_id'    => $id,
            'type'       => $type,
            'title'      => $title,
            'message'    => $message,
            'link'       => $link,
            'created_at' => $now,
            'updated_at' => $now,
        ], array_unique(array_filter($userIds)));

        if (! empty($rows)) {
            Notification::insert($rows);
        }
    }
}
