<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cahier des charges §7.4 « Demandes d'intervention » :
 *   - « une catégorie de problème »                 → service_requests.category
 *   - « photo ou vidéo facultative »                 → service_requests.attachment_*
 *   - « les notes internes restent invisibles au client » → service_request_histories.is_internal
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('service_requests', 'category')) {
                $table->string('category', 40)->nullable()->after('reason');
            }
            if (! Schema::hasColumn('service_requests', 'attachment_path')) {
                $table->string('attachment_path', 255)->nullable()->after('description');
            }
            if (! Schema::hasColumn('service_requests', 'attachment_name')) {
                $table->string('attachment_name', 191)->nullable()->after('attachment_path');
            }
            if (! Schema::hasColumn('service_requests', 'attachment_mime')) {
                $table->string('attachment_mime', 100)->nullable()->after('attachment_name');
            }
        });

        Schema::table('service_request_histories', function (Blueprint $table) {
            if (! Schema::hasColumn('service_request_histories', 'is_internal')) {
                $table->boolean('is_internal')->default(false)->after('comment');
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            $table->dropColumn(['category', 'attachment_path', 'attachment_name', 'attachment_mime']);
        });
        Schema::table('service_request_histories', function (Blueprint $table) {
            $table->dropColumn('is_internal');
        });
    }
};
