#!/usr/bin/perl
use strict;
use IO::Socket::INET;
use File::Slurp qw(read_file);
use POSIX qw(strftime);

my $port = 3400;
my $root = '.';

my $server = IO::Socket::INET->new(
    LocalPort => $port,
    Type      => SOCK_STREAM,
    Reuse     => 1,
    Listen    => 10,
) or die "Cannot bind to port $port: $!";

print "Serving on http://localhost:$port\n";

while (my $client = $server->accept()) {
    my $request = <$client>;
    chomp(my $path = (split /\s+/, $request)[1]);
    $path = '/index.html' if $path eq '/';
    $path =~ s/\?.*//;

    my $file = $root . $path;
    my ($status, $type, $body);
    if (-f $file) {
        open my $fh, '<', $file or die;
        local $/; $body = <$fh>; close $fh;
        $status = '200 OK';
        $type = $file =~ /\.html$/ ? 'text/html' : 'text/plain';
    } else {
        $body = "Not found: $path";
        $status = '404 Not Found';
        $type = 'text/plain';
    }

    while (<$client>) { last if /^\r?\n$/; } # drain headers

    print $client "HTTP/1.1 $status\r\n";
    print $client "Content-Type: $type; charset=utf-8\r\n";
    print $client "Content-Length: " . length($body) . "\r\n";
    print $client "Connection: close\r\n\r\n";
    print $client $body;
    close $client;
}
